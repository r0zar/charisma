/**
 * Balance Client - Fetches balance data from simple-swap API endpoints
 * This provides balance data with automatic fallback to individual requests
 */

import { getHostUrl } from '@modules/discovery';

export interface BalanceResponse {
  address: string;
  lastUpdated: string;
  source: string;
  stxBalance: string;
  fungibleTokens: Record<string, { balance: string; decimals?: number }>;
  nonFungibleTokens: Record<string, any>;
  metadata: {
    cacheSource: string;
    tokenCount: number;
    nftCount: number;
    stxLocked: string;
    stxTotalSent: string;
    stxTotalReceived: string;
  };
}

export interface BulkBalanceResponse {
  success: boolean;
  balances: Record<string, BalanceResponse>;
  errors?: Record<string, string>;
  meta: {
    timestamp: string;
    total: number;
    successful: number;
    failed: number;
  };
}

export class BalanceClient {
  private readonly BASE_URL: string | undefined;

  constructor(baseUrl?: string) {
    // Store the base URL, but don't resolve it immediately
    this.BASE_URL = baseUrl;
  }

  private getBaseUrl(): string {
    if (this.BASE_URL !== undefined) {
      return this.BASE_URL;
    }
    
    // Lazy resolution: only resolve when actually needed
    return typeof window !== 'undefined' 
      ? '' // Client-side: use relative URLs
      : getHostUrl('swap'); // Server-side: use discovery module to get swap host
  }

  /**
   * Get balance data for an address
   */
  async getAddressBalances(address: string, includeZeroBalances: boolean = true): Promise<BalanceResponse | null> {
    try {
      console.log(`[BalanceClient] Fetching balances for ${address} (includeZero: ${includeZeroBalances})`);
      
      const url = `${this.getBaseUrl()}/api/v1/balances/${address}${includeZeroBalances ? '?includeZero=true' : ''}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[BalanceClient] Address not found: ${address}`);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
      
    } catch (error) {
      console.error(`[BalanceClient] Failed to fetch balances for ${address}:`, error);
      return null;
    }
  }

  /**
   * Get STX balance for an address (in micro-STX)
   */
  async getStxBalance(address: string): Promise<number> {
    const balances = await this.getAddressBalances(address, true);
    if (!balances?.stxBalance) {
      return 0;
    }
    return parseInt(balances.stxBalance, 10);
  }

  /**
   * Get token balance for a specific contract ID
   */
  async getTokenBalance(address: string, contractId: string): Promise<string> {
    const balances = await this.getAddressBalances(address, true);
    if (!balances?.fungibleTokens?.[contractId]?.balance) {
      return '0';
    }
    return balances.fungibleTokens[contractId].balance;
  }

  /**
   * Get all fungible token balances for an address
   * Returns only tokens with non-zero balances by default
   */
  async getFungibleTokenBalances(
    address: string, 
    includeZeroBalances: boolean = false
  ): Promise<Record<string, { balance: string; decimals?: number }>> {
    const balances = await this.getAddressBalances(address, includeZeroBalances);
    if (!balances?.fungibleTokens) {
      return {};
    }

    return balances.fungibleTokens;
  }

  /**
   * Check if address has sufficient balance for a token amount
   */
  async hasSufficientBalance(
    address: string, 
    contractId: string, 
    requiredAmount: string
  ): Promise<{ sufficient: boolean; actualBalance: string; requiredAmount: string }> {
    try {
      const actualBalance = await this.getTokenBalance(address, contractId);
      const sufficient = BigInt(actualBalance) >= BigInt(requiredAmount);

      return {
        sufficient,
        actualBalance,
        requiredAmount
      };
    } catch (error) {
      console.error(`[BalanceClient] Error checking balance sufficiency:`, error);
      return {
        sufficient: false,
        actualBalance: '0',
        requiredAmount
      };
    }
  }

  /**
   * Batch fetch balances for multiple addresses using the bulk endpoint
   */
  async getBulkBalances(addresses: string[], includeZeroBalances: boolean = true): Promise<Record<string, BalanceResponse | null>> {
    console.log(`[BalanceClient] Fetching balances for ${addresses.length} addresses (includeZero: ${includeZeroBalances})`);
    
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/v1/balances`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addresses, includeZeroBalances }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: BulkBalanceResponse = await response.json();
      
      if (data.success && data.balances) {
        return data.balances;
      }

      console.warn(`[BalanceClient] Bulk request returned no balances`);
      return {};
      
    } catch (error) {
      console.error(`[BalanceClient] Bulk request failed, falling back to individual requests:`, error);
      
      // Fallback to individual requests
      const balancePromises = addresses.map(async (address) => {
        const balances = await this.getAddressBalances(address, includeZeroBalances);
        return { address, balances };
      });

      const results = await Promise.all(balancePromises);
      
      const balanceMap: Record<string, BalanceResponse | null> = {};
      results.forEach(({ address, balances }) => {
        balanceMap[address] = balances;
      });

      return balanceMap;
    }
  }
}

// Export singleton instance - base URL will be resolved lazily when needed
export const balanceClient = new BalanceClient();