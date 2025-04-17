/**
 * Direct swap client for simple-swap
 */
import { Dexterity, Route } from '@repo/dexterity';

/**
 * API response interfaces
 */
export interface Token {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  image?: string;
}

export interface QuoteResponse {
  route: Route;
  amountIn: number;
  amountOut: number;
  expectedPrice: number;
  minimumReceived: number;
}

export interface ApiError {
  error: string;
}

/**
 * Client configuration
 */
export interface SwapClientOptions {
  apiUrl?: string;
  routerAddress?: string;
  routerName?: string;
}

/**
 * Create a swap client with the given options
 */
export function createSwapClient(options: SwapClientOptions = {}) {
  // Default configuration
  const config = {
    apiUrl: options.apiUrl || "http://localhost:5001/api/dexterity",
    routerAddress: options.routerAddress || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
    routerName: options.routerName || 'multihop'
  };

  // Configure Dexterity if router info provided
  if (config.routerAddress && config.routerName) {
    Dexterity.configureRouter(config.routerAddress, config.routerName);
  }

  // Method for fetching data with error handling
  async function fetchData<T>(url: string): Promise<T> {
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Failed to fetch data from ${url}`);
    }

    return await response.json();
  }

  // Client implementation
  return {
    /**
     * Get available tokens
     */
    async getTokens(): Promise<Token[]> {
      try {
        return await fetchData(`${config.apiUrl}/tokens`);
      } catch (error) {
        console.error('Error fetching tokens:', error);
        throw error;
      }
    },

    /**
     * Get a quote for swapping tokens
     */
    async getQuote(
      fromTokenId: string,
      toTokenId: string,
      amount: string | number
    ): Promise<QuoteResponse> {
      try {
        return await fetchData(
          `${config.apiUrl}/quote?fromTokenId=${encodeURIComponent(fromTokenId)}&toTokenId=${encodeURIComponent(toTokenId)}&amount=${amount}`
        );
      } catch (error) {
        console.error('Error fetching quote:', error);
        throw error;
      }
    },

    /**
     * Execute a token swap
     */
    async executeSwap(route: Route): Promise<{ txId: string } | { error: string }> {
      try {
        const response = await Dexterity.executeSwapRoute(route);

        if (typeof response === 'string') {
          return { txId: response };
        } else {
          return { error: 'Swap failed' };
        }
      } catch (error) {
        console.error('Error executing swap:', error);
        return {
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },

    /**
     * Utility functions for working with token amounts
     */
    formatTokenAmount(amount: number, decimals: number): string {
      return (amount / Math.pow(10, decimals)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
      });
    },

    /**
     * Convert user input to micro units based on token decimals
     */
    convertToMicroUnits(input: string, decimals: number): string {
      if (!input || input === '') return '0';
      try {
        const floatValue = parseFloat(input);
        if (isNaN(floatValue)) return '0';
        return Math.floor(floatValue * Math.pow(10, decimals)).toString();
      } catch {
        return '0';
      }
    },

    /**
     * Convert micro units to human readable format for input
     */
    convertFromMicroUnits(microUnits: string, decimals: number): string {
      if (!microUnits || microUnits === '0') return '';
      try {
        const value = parseInt(microUnits, 10);
        if (isNaN(value)) return '';

        const humanReadable = (value / Math.pow(10, decimals)).toString();
        return humanReadable.includes('.') ?
          humanReadable.replace(/\.?0+$/, '') :
          humanReadable;
      } catch {
        return '';
      }
    },

    /**
     * Get token logo URL
     */
    getTokenLogo(token: Token): string {
      if (token.image) {
        return token.image;
      }

      const symbol = token.symbol?.toLowerCase() || '';

      if (symbol === "stx") {
        return "https://assets.coingecko.com/coins/images/2069/standard/Stacks_logo_full.png";
      } else if (symbol.includes("btc") || symbol.includes("xbtc")) {
        return "https://assets.coingecko.com/coins/images/1/standard/bitcoin.png";
      } else if (symbol.includes("usda")) {
        return "https://assets.coingecko.com/coins/images/17333/standard/usda.png";
      }

      // Default logo - first 2 characters of symbol
      return `https://placehold.co/32x32?text=${(token.symbol || "??").slice(0, 2)}`;
    }
  };
}

/**
 * Default swap client instance
 */
export const swapClient = createSwapClient({
  apiUrl: "http://localhost:5001/api/dexterity"
});