/**
 * Cached Balance Client - Uses the data app's cached balance endpoint
 * This provides fast, cached balance data with automatic refresh
 */

import { getHostUrl } from '@modules/discovery';

export interface CachedBalanceResponse {
  stx: {
    balance: string;
    locked: string;
    burn_block_height: number;
    total_sent: string;
    total_received: string;
    total_fees_sent: string;
    total_miner_rewards_received: string;
    lock_tx_id: string;
    lock_height: number;
    burnchain_lock_height: number;
    burnchain_unlock_height: number;
  };
  fungible_tokens: {
    [contractId: string]: {
      balance: string;
      total_sent: string;
      total_received: string;
    };
  };
  non_fungible_tokens: {
    [contractId: string]: {
      count: string;
      total_sent: string;
      total_received: string;
    };
  };
}

export class CachedBalanceClient {
  private readonly DATA_APP_BASE_URL: string;

  constructor() {
    // Use discovery module for data app URL
    this.DATA_APP_BASE_URL = getHostUrl('data');
  }

  /**
   * Get cached balance data for an address
   */
  async getAddressBalances(address: string): Promise<CachedBalanceResponse | null> {
    try {
      console.log(`[CachedBalanceClient] Fetching cached balances for ${address}`);
      
      const response = await fetch(`${this.DATA_APP_BASE_URL}/api/v1/addresses/${address}/balances`, {
        headers: {
          'Accept': 'application/json',
        },
        // Add timeout for production robustness
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[CachedBalanceClient] Address not found: ${address}`);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Log cache performance info if available
      const responseTime = response.headers.get('X-Response-Time');
      const dataSource = response.headers.get('X-Data-Source');
      
      if (responseTime && dataSource) {
        console.log(`[CachedBalanceClient] Got ${dataSource} data in ${responseTime} for ${address}`);
      }

      return data;
      
    } catch (error) {
      console.error(`[CachedBalanceClient] Failed to fetch balances for ${address}:`, error);
      return null;
    }
  }

  /**
   * Get STX balance for an address (in micro-STX)
   */
  async getStxBalance(address: string): Promise<number> {
    const balances = await this.getAddressBalances(address);
    if (!balances?.stx?.balance) {
      return 0;
    }
    return parseInt(balances.stx.balance, 10);
  }

  /**
   * Get token balance for a specific contract ID
   */
  async getTokenBalance(address: string, contractId: string): Promise<string> {
    const balances = await this.getAddressBalances(address);
    if (!balances?.fungible_tokens?.[contractId]?.balance) {
      return '0';
    }
    return balances.fungible_tokens[contractId].balance;
  }

  /**
   * Get all fungible token balances for an address
   * Returns only tokens with non-zero balances by default
   */
  async getFungibleTokenBalances(
    address: string, 
    includeZeroBalances: boolean = false
  ): Promise<Record<string, { balance: string; total_sent: string; total_received: string }>> {
    const balances = await this.getAddressBalances(address);
    if (!balances?.fungible_tokens) {
      return {};
    }

    if (includeZeroBalances) {
      return balances.fungible_tokens;
    }

    // Filter out zero balances
    const nonZeroBalances: Record<string, { balance: string; total_sent: string; total_received: string }> = {};
    
    Object.entries(balances.fungible_tokens).forEach(([contractId, tokenBalance]) => {
      if (tokenBalance.balance !== '0' && tokenBalance.balance !== '') {
        nonZeroBalances[contractId] = tokenBalance;
      }
    });

    return nonZeroBalances;
  }

  /**
   * Get all NFT collections for an address
   * Returns only collections with non-zero count by default
   */
  async getNftBalances(
    address: string, 
    includeZeroBalances: boolean = false
  ): Promise<Record<string, { count: string; total_sent: string; total_received: string }>> {
    const balances = await this.getAddressBalances(address);
    if (!balances?.non_fungible_tokens) {
      return {};
    }

    if (includeZeroBalances) {
      return balances.non_fungible_tokens;
    }

    // Filter out zero counts
    const nonZeroBalances: Record<string, { count: string; total_sent: string; total_received: string }> = {};
    
    Object.entries(balances.non_fungible_tokens).forEach(([contractId, nftBalance]) => {
      if (nftBalance.count !== '0' && nftBalance.count !== '') {
        nonZeroBalances[contractId] = nftBalance;
      }
    });

    return nonZeroBalances;
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
      console.error(`[CachedBalanceClient] Error checking balance sufficiency:`, error);
      return {
        sufficient: false,
        actualBalance: '0',
        requiredAmount
      };
    }
  }

  /**
   * Batch fetch balances for multiple addresses
   * This could be optimized further with a dedicated bulk endpoint
   */
  async getBulkBalances(addresses: string[]): Promise<Record<string, CachedBalanceResponse | null>> {
    console.log(`[CachedBalanceClient] Fetching balances for ${addresses.length} addresses`);
    
    const balancePromises = addresses.map(async (address) => {
      const balances = await this.getAddressBalances(address);
      return { address, balances };
    });

    const results = await Promise.all(balancePromises);
    
    const balanceMap: Record<string, CachedBalanceResponse | null> = {};
    results.forEach(({ address, balances }) => {
      balanceMap[address] = balances;
    });

    return balanceMap;
  }
}

/**
 * Token metadata interface matching the contract registry structure
 */
export interface CachedTokenMetadata {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  type: 'SIP-010' | 'SUBNET' | 'LP' | 'WRAPPED' | 'SYNTHETIC';
  logo?: string;
  description?: string;
  website?: string;
  coingeckoId?: string;
  tags?: string[];
  verified: boolean;
  lastUpdated?: number;
}

/**
 * Cached Token Metadata Client - Uses the data app's cached token metadata
 */
export class CachedTokenMetadataClient {
  private readonly DATA_APP_BASE_URL: string;

  constructor() {
    // Use discovery module for data app URL
    this.DATA_APP_BASE_URL = getHostUrl('data');
  }

  /**
   * Get all token metadata from cache
   */
  async getAllTokens(): Promise<CachedTokenMetadata[]> {
    try {
      console.log(`[CachedTokenMetadataClient] Fetching all cached token metadata`);
      
      const response = await fetch(`${this.DATA_APP_BASE_URL}/api/v1/contracts`, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Log cache performance info if available
      const responseTime = response.headers.get('X-Response-Time');
      const dataSource = response.headers.get('X-Data-Source');
      
      if (responseTime && dataSource) {
        console.log(`[CachedTokenMetadataClient] Got ${dataSource} metadata in ${responseTime}`);
      }

      // Convert to expected format if needed
      if (Array.isArray(data)) {
        return data;
      } else if (data.tokens && Array.isArray(data.tokens)) {
        return data.tokens;
      } else if (typeof data === 'object') {
        // If it's an object with contract IDs as keys, convert to array
        return Object.values(data) as CachedTokenMetadata[];
      }

      return [];
      
    } catch (error) {
      console.error(`[CachedTokenMetadataClient] Failed to fetch token metadata:`, error);
      return [];
    }
  }

  /**
   * Get specific token metadata by contract ID
   */
  async getTokenMetadata(contractId: string): Promise<CachedTokenMetadata | null> {
    try {
      console.log(`[CachedTokenMetadataClient] Fetching metadata for ${contractId}`);
      
      const response = await fetch(`${this.DATA_APP_BASE_URL}/api/v1/contracts/${contractId.replace('.', '/')}`, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[CachedTokenMetadataClient] Token not found: ${contractId}`);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
      
    } catch (error) {
      console.error(`[CachedTokenMetadataClient] Failed to fetch metadata for ${contractId}:`, error);
      return null;
    }
  }

  /**
   * Get token metadata for multiple contract IDs
   */
  async getBulkTokenMetadata(contractIds: string[]): Promise<Record<string, CachedTokenMetadata>> {
    console.log(`[CachedTokenMetadataClient] Fetching metadata for ${contractIds.length} tokens`);
    
    const metadataPromises = contractIds.map(async (contractId) => {
      const metadata = await this.getTokenMetadata(contractId);
      return { contractId, metadata };
    });

    const results = await Promise.all(metadataPromises);
    
    const metadataMap: Record<string, CachedTokenMetadata> = {};
    results.forEach(({ contractId, metadata }) => {
      if (metadata) {
        metadataMap[contractId] = metadata;
      }
    });

    return metadataMap;
  }

  /**
   * Get tokens filtered by type
   */
  async getTokensByType(type: CachedTokenMetadata['type']): Promise<CachedTokenMetadata[]> {
    const allTokens = await this.getAllTokens();
    return allTokens.filter(token => token.type === type);
  }

  /**
   * Search tokens by symbol or name
   */
  async searchTokens(query: string): Promise<CachedTokenMetadata[]> {
    const allTokens = await this.getAllTokens();
    const searchQuery = query.toLowerCase();
    
    return allTokens.filter(token => 
      token.symbol.toLowerCase().includes(searchQuery) || 
      token.name.toLowerCase().includes(searchQuery) ||
      token.contractId.toLowerCase().includes(searchQuery)
    );
  }
}

/**
 * Price data interface matching the expected structure
 */
export interface CachedPriceData {
  usdPrice: number;
  change24h?: number;
  change7d?: number;
  marketCap?: number;
  volume24h?: number;
  lastUpdated?: number;
  source?: string;
  confidence?: number;
  isLpToken?: boolean;
  intrinsicValue?: number;
  marketPrice?: number;
  priceDeviation?: number;
  isArbitrageOpportunity?: boolean;
  pathsUsed?: number;
  totalLiquidity?: number;
  priceSource?: 'market' | 'intrinsic' | 'hybrid';
}

/**
 * Cached Price Client - Uses the data app's cached price data
 */
export class CachedPriceClient {
  private readonly DATA_APP_BASE_URL: string;

  constructor() {
    // Use discovery module for data app URL
    this.DATA_APP_BASE_URL = getHostUrl('data');
  }

  /**
   * Get all token prices from cache
   */
  async getAllPrices(): Promise<Record<string, CachedPriceData>> {
    try {
      console.log(`[CachedPriceClient] Fetching all cached price data`);
      
      const response = await fetch(`${this.DATA_APP_BASE_URL}/api/v1/prices`, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Log cache performance info if available
      const responseTime = response.headers.get('X-Response-Time');
      const dataSource = response.headers.get('X-Data-Source');
      
      if (responseTime && dataSource) {
        console.log(`[CachedPriceClient] Got ${dataSource} price data in ${responseTime}`);
      }

      // Convert to expected format - data app now returns oracle price format
      const convertedPrices: Record<string, CachedPriceData> = {};
      
      if (typeof data === 'object' && data !== null) {
        Object.entries(data).forEach(([contractId, priceInfo]: [string, any]) => {
          if (priceInfo && typeof priceInfo.usdPrice === 'number') {
            // New oracle format
            convertedPrices[contractId] = {
              usdPrice: priceInfo.usdPrice,
              change24h: priceInfo.change24h,
              volume24h: priceInfo.volume24h,
              marketCap: priceInfo.marketCap,
              lastUpdated: priceInfo.lastUpdated || Date.now(),
              source: priceInfo.source || 'oracle-data-app',
              confidence: priceInfo.confidence || 1,
              isLpToken: priceInfo.isLpToken,
              intrinsicValue: priceInfo.intrinsicValue,
              marketPrice: priceInfo.marketPrice,
              priceDeviation: priceInfo.priceDeviation,
              isArbitrageOpportunity: priceInfo.isArbitrageOpportunity,
              pathsUsed: priceInfo.pathsUsed,
              totalLiquidity: priceInfo.totalLiquidity,
              priceSource: priceInfo.priceSource
            };
          } else if (priceInfo && priceInfo.current) {
            // Legacy format fallback
            convertedPrices[contractId] = {
              usdPrice: parseFloat(priceInfo.current.price || '0'),
              change24h: parseFloat(priceInfo.current.change_24h || '0'),
              volume24h: parseFloat(priceInfo.current.volume_24h || '0'),
              marketCap: parseFloat(priceInfo.current.market_cap || '0'),
              lastUpdated: priceInfo.current.timestamp ? new Date(priceInfo.current.timestamp).getTime() : Date.now(),
              source: 'legacy-data-app',
              confidence: 1
            };
          }
        });
      }

      return convertedPrices;
      
    } catch (error) {
      console.error(`[CachedPriceClient] Failed to fetch price data:`, error);
      return {};
    }
  }

  /**
   * Get specific token price by contract ID
   */
  async getTokenPrice(contractId: string): Promise<CachedPriceData | null> {
    try {
      console.log(`[CachedPriceClient] Fetching price for ${contractId}`);
      
      const response = await fetch(`${this.DATA_APP_BASE_URL}/api/v1/prices/${contractId.replace('.', '/')}`, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[CachedPriceClient] Price not found: ${contractId}`);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
      
    } catch (error) {
      console.error(`[CachedPriceClient] Failed to fetch price for ${contractId}:`, error);
      return null;
    }
  }

  /**
   * Get prices for multiple contract IDs
   */
  async getBulkPrices(contractIds: string[]): Promise<Record<string, CachedPriceData>> {
    console.log(`[CachedPriceClient] Fetching prices for ${contractIds.length} tokens`);
    
    // For efficiency, get all prices at once and filter
    const allPrices = await this.getAllPrices();
    
    const filteredPrices: Record<string, CachedPriceData> = {};
    contractIds.forEach(contractId => {
      if (allPrices[contractId]) {
        filteredPrices[contractId] = allPrices[contractId];
      }
    });

    return filteredPrices;
  }

  /**
   * Get USD price for a specific token (simple number return)
   */
  async getUsdPrice(contractId: string): Promise<number> {
    const priceData = await this.getTokenPrice(contractId);
    return priceData?.usdPrice || 0;
  }

  /**
   * Get STX price in USD
   */
  async getStxPrice(): Promise<number> {
    // STX typically has a special identifier or is at the root
    const stxPriceData = await this.getTokenPrice('STX') || await this.getTokenPrice('stacks-token');
    return stxPriceData?.usdPrice || 0;
  }

  /**
   * Check if price data exists for a token
   */
  async hasPriceData(contractId: string): Promise<boolean> {
    const priceData = await this.getTokenPrice(contractId);
    return priceData !== null && typeof priceData.usdPrice === 'number' && priceData.usdPrice > 0;
  }

  /**
   * Get price data with change information
   */
  async getPriceWithChanges(contractId: string): Promise<{
    price: number;
    change24h?: number;
    change7d?: number;
    lastUpdated?: number;
  } | null> {
    const priceData = await this.getTokenPrice(contractId);
    
    if (!priceData) {
      return null;
    }

    return {
      price: priceData.usdPrice,
      change24h: priceData.change24h,
      change7d: priceData.change7d,
      lastUpdated: priceData.lastUpdated
    };
  }

  /**
   * Get price data in the format expected by existing components
   */
  async getPriceInKraxelFormat(contractId: string): Promise<{
    usdPrice: number;
    change24h?: number;
    confidence: number;
    lastUpdated?: number;
  } | null> {
    const priceData = await this.getTokenPrice(contractId);
    
    if (!priceData) {
      return null;
    }

    return {
      usdPrice: priceData.usdPrice,
      change24h: priceData.change24h,
      confidence: priceData.confidence || 1,
      lastUpdated: priceData.lastUpdated || Date.now()
    };
  }

  /**
   * Get all prices in Kraxel format for compatibility
   */
  async getAllPricesInKraxelFormat(): Promise<Record<string, {
    usdPrice: number;
    change24h?: number;
    confidence: number;
    lastUpdated?: number;
  }>> {
    const allPrices = await this.getAllPrices();
    const kraxelPrices: Record<string, any> = {};

    Object.entries(allPrices).forEach(([contractId, priceData]) => {
      kraxelPrices[contractId] = {
        usdPrice: priceData.usdPrice,
        change24h: priceData.change24h,
        confidence: priceData.confidence || 1,
        lastUpdated: priceData.lastUpdated || Date.now()
      };
    });

    return kraxelPrices;
  }
}

// Export singleton instances
export const cachedBalanceClient = new CachedBalanceClient();
export const cachedTokenMetadataClient = new CachedTokenMetadataClient();
export const cachedPriceClient = new CachedPriceClient();