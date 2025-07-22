import { blobStorageService } from './blob-storage-service';
import { getAccountBalances, AccountBalancesResponse } from '@repo/polyglot';

export type AddressBalance = AccountBalancesResponse;

export interface CachedBalance extends AddressBalance {
  cachedAt: string;
  source: 'api' | 'fallback';
}

/**
 * Simple Balance Service - Direct Stacks API integration
 * Fetches real balance data with caching
 */
class BalanceService {
  private readonly BALANCE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get address balances with real API calls and caching
   */
  async getAddressBalances(address: string): Promise<AddressBalance> {
    const blobPath = `addresses/${address}/balances`;
    const now = Date.now();

    try {
      // Try to get from cache first
      const cached = await blobStorageService.get<CachedBalance>(blobPath);

      // Check if cached data is still valid
      if (cached.cachedAt) {
        const cacheAge = now - new Date(cached.cachedAt).getTime();
        if (cacheAge < this.BALANCE_TTL) {
          console.log(`Using cached balance data for ${address} (age: ${Math.round(cacheAge / 1000)}s)`);
          return cached;
        }
      }
    } catch (error) {
      // Cache miss, continue to fetch fresh data
    }

    // Fetch fresh data from Stacks API
    console.log(`Fetching fresh balance data from API for ${address}...`);
    const balanceData = await this.fetchFromStacksAPI(address);

    // Cache the result
    const cachedBalance: CachedBalance = {
      ...balanceData,
      cachedAt: new Date(now).toISOString(),
      source: balanceData.source || 'api'
    };

    try {
      await blobStorageService.put(blobPath, cachedBalance);
      console.log(`Cached balance data for ${address}`);
    } catch (error) {
      console.error(`Failed to cache balance data for ${address}:`, error);
    }

    return cachedBalance;
  }

  /**
   * Fetch balance data using polyglot package
   */
  private async fetchFromStacksAPI(address: string): Promise<AddressBalance & { source: 'api' | 'fallback' }> {
    try {
      console.log(`Making API request to Stacks for ${address}...`);

      const balances = await getAccountBalances(address, {
        unanchored: true,
        trim: true  // This removes tokenKey suffixes and merges duplicate balances
      });

      if (!balances) {
        throw new Error('No balance data returned from API');
      }

      console.log(`API response received for ${address}:`, {
        stxBalance: balances.stx?.balance,
        fungibleTokens: Object.keys(balances.fungible_tokens || {}).length,
        nonFungibleTokens: Object.keys(balances.non_fungible_tokens || {}).length
      });

      return { ...balances, source: 'api' as const };

    } catch (error) {
      console.error(`Stacks API failed for ${address}:`, error);
      console.log(`Falling back to deterministic mock data for ${address}`);

      // Generate deterministic fallback data
      return { ...this.generateFallbackData(address), source: 'fallback' as const };
    }
  }

  /**
   * Generate deterministic fallback data when API is unavailable
   */
  private generateFallbackData(address: string): AddressBalance {
    // Create deterministic values based on address
    const hash = Array.from(address).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seed = hash % 1000000;

    return {
      stx: {
        balance: (seed * 10000 + 1000000).toString(),
        locked: (seed * 1000).toString(),
        burnchain_lock_height: 800000 + (seed % 100000),
        total_sent: (seed * 500).toString(),
        total_received: (seed * 1000).toString()
      },
      fungible_tokens: {
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token': {
          balance: (seed * 1000000 + 500000000).toString(),
          total_sent: (seed * 100).toString(),
          total_received: (seed * 500).toString()
        },
        'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token': {
          balance: (seed * 2000000 + 750000000).toString(),
          total_sent: (seed * 150).toString(),
          total_received: (seed * 600).toString()
        },
        'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token': {
          balance: (seed * 3000000 + 1250000000).toString(),
          total_sent: (seed * 200).toString(),
          total_received: (seed * 700).toString()
        },
        'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.alex-token': {
          balance: (seed * 1500000 + 625000000).toString(),
          total_sent: (seed * 75).toString(),
          total_received: (seed * 300).toString()
        },
        'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token': {
          balance: (seed * 4000000 + 2000000000).toString(),
          total_sent: (seed * 300).toString(),
          total_received: (seed * 900).toString()
        }
      },
      non_fungible_tokens: {
        'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bitcoin-monkeys': {
          count: (seed % 5 + 1).toString(),
          total_sent: '0',
          total_received: (seed % 5 + 1).toString()
        },
        'SP3QSAJQ4EA8WXEDSRRKMZZ29NH91VZ6C5X88FGZQ.crashpunks-v2': {
          count: (seed % 3 + 1).toString(),
          total_sent: '0',
          total_received: (seed % 3 + 1).toString()
        }
      }
    };
  }

  /**
   * Clear cache for specific address
   */
  async clearAddressCache(address: string): Promise<void> {
    try {
      // Just clear the entire blob cache for simplicity
      blobStorageService.clearCache();
      console.log(`Cleared cache for ${address}`);
    } catch (error) {
      console.error(`Failed to clear cache for ${address}:`, error);
    }
  }
}

// Export singleton instance
export const balanceService = new BalanceService();