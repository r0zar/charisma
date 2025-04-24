/** * Direct swap client for simple-swap, integrated with dex-cache
 */
import { Dexterity, Route, Vault } from '@repo/dexterity';
import { getQuote as getQuoteAction } from '../app/actions';

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
 * Server action response interfaces
 */
interface ServerActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Client configuration
 */
export interface SwapClientOptions {
  /**
   * URL for the dex-cache API (used for fetching vaults and tokens)
   */
  dexCacheUrl?: string;

  routerAddress?: string;
  routerName?: string;
}

/**
 * Create a swap client with the given options
 */
export function createSwapClient(options: SwapClientOptions = {}) {
  // Default configuration
  const config = {
    dexCacheUrl: options.dexCacheUrl || "https://charisma-dex-cache.vercel.app/api/v1",
    routerAddress: options.routerAddress || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
    routerName: options.routerName || 'multihop'
  };

  // Configure Dexterity if router info provided
  if (config.routerAddress && config.routerName) {
    Dexterity.configureRouter(
      config.routerAddress,
      config.routerName,
      { debug: true, maxHops: 2 }
    );
  }

  // In-memory cache for quotes with 1-second expiry
  interface CachedQuote {
    quote: QuoteResponse;
    timestamp: number;
  }

  const quoteCache = new Map<string, CachedQuote>();
  const CACHE_EXPIRY_MS = 1000; // 1 second

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
     * Get available vaults from dex-cache
     */
    async getVaults(): Promise<Vault[]> {
      try {
        const response = await fetchData<{ status: string; data: Vault[] }>(`${config.dexCacheUrl}/vaults`);
        if (response.status === 'success' && Array.isArray(response.data)) {
          return response.data;
        }
        throw new Error('Invalid response format from dex-cache');
      } catch (error) {
        console.error('Error fetching vaults from dex-cache:', error);
        throw error;
      }
    },

    /**
     * Get a specific vault by contract ID
     */
    async getVault(contractId: string): Promise<Vault> {
      try {
        const response = await fetchData<{ status: string; data: Vault }>(`${config.dexCacheUrl}/vaults/${encodeURIComponent(contractId)}`);
        if (response.status === 'success' && response.data) {
          return response.data;
        }
        throw new Error(`Vault not found: ${contractId}`);
      } catch (error) {
        console.error(`Error fetching vault ${contractId}:`, error);
        throw error;
      }
    },

    /**
     * Get available tokens (adapted to work with dex-cache vaults)
     * This maintains backward compatibility with the original implementation
     */
    async getTokens(): Promise<Token[]> {
      try {
        // Try to get tokens from dex-cache first
        try {
          const vaults = await this.getVaults();

          // Create a map to deduplicate tokens
          const tokenMap = new Map<string, Token>();

          // Process each vault to extract both the LP token and underlying tokens
          vaults.forEach(vault => {
            // Add LP token
            if (!tokenMap.has(vault.contractId)) {
              tokenMap.set(vault.contractId, {
                contractId: vault.contractId,
                name: vault.name,
                symbol: vault.symbol,
                decimals: vault.decimals,
                image: vault.image
              });
            }

            // Add Token A if it has required fields
            if (vault.tokenA && vault.tokenA.contractId && !tokenMap.has(vault.tokenA.contractId)) {
              tokenMap.set(vault.tokenA.contractId, {
                contractId: vault.tokenA.contractId,
                name: vault.tokenA.name || '',
                symbol: vault.tokenA.symbol || '',
                decimals: vault.tokenA.decimals || 0,
                image: vault.tokenA.image
              });
            }

            // Add Token B if it has required fields
            if (vault.tokenB && vault.tokenB.contractId && !tokenMap.has(vault.tokenB.contractId)) {
              tokenMap.set(vault.tokenB.contractId, {
                contractId: vault.tokenB.contractId,
                name: vault.tokenB.name || '',
                symbol: vault.tokenB.symbol || '',
                decimals: vault.tokenB.decimals || 0,
                image: vault.tokenB.image
              });
            }
          });

          // Convert map to array
          return Array.from(tokenMap.values());
        } catch (dexCacheError) {
          console.warn('Failed to fetch tokens from dex-cache', dexCacheError);
          // Return empty array when there's an error
          return [];
        }
      } catch (error) {
        console.error('Error fetching tokens:', error);
        // Always return something, even if empty
        return [];
      }
    },

    /**
     * Get a quote for swapping tokens with in-memory caching (1 second)
     * Uses server action instead of direct fetch
     */
    async getQuote(
      fromTokenId: string,
      toTokenId: string,
      amount: string | number
    ): Promise<QuoteResponse> {
      // Create a cache key
      const cacheKey = `${fromTokenId}-${toTokenId}-${amount}`;

      // Check if we have a valid cache entry
      const now = Date.now();
      const cached = quoteCache.get(cacheKey);

      if (cached && (now - cached.timestamp < CACHE_EXPIRY_MS)) {
        console.log(`Using cached quote for ${cacheKey}`);
        return cached.quote;
      }

      try {
        // Call the server action to get a quote
        const response = await getQuoteAction(fromTokenId, toTokenId, amount.toString());

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to get quote');
        }

        // We now know response.data is defined
        const quote: QuoteResponse = response.data;

        // Cache the result
        quoteCache.set(cacheKey, {
          quote,
          timestamp: now
        });

        return quote;
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

        // Check if response is an object and has txId
        if (typeof response === 'object' && response !== null && 'txId' in response && typeof response.txId === 'string') {
          return { txId: response.txId };
        }

        // If it's not a string txId or the expected object, assume failure
        console.warn('Unexpected swap response format:', response);
        return { error: 'Swap failed due to unexpected response format' };
      } catch (error) {
        console.error('Error executing swap:', error);
        return {
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },

    /**
     * Clear the quote cache - useful when testing or when token prices might have changed
     */
    clearQuoteCache(): void {
      quoteCache.clear();
      console.log('Quote cache cleared');
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
 * 
 * - Uses dex-cache API for vaults and tokens (primary source)
 * - Uses dexterity API for quotes and as fallback for tokens
 */
export const swapClient = createSwapClient({
  dexCacheUrl: "http://localhost:3003/api/v1"
});
