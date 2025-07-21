/**
 * Whale Detection Service - Classifies addresses based on token holdings and value
 */

import type { BalanceStore } from '../types';

export interface WhaleDetectionConfig {
  thresholdUSD: number;
  smallWhaleThreshold?: number;  // $10k
  mediumWhaleThreshold?: number; // $50k  
  largeWhaleThreshold?: number;  // $250k
  megaWhaleThreshold?: number;   // $1M
}

export interface WhaleClassificationResult {
  address: string;
  classification: 'small' | 'medium' | 'large' | 'mega' | 'none';
  totalValue: string;
  totalValueUSD?: number;
  tokenCount: number;
  topTokens: Array<{
    contract: string;
    balance: string;
    valueUSD?: number;
  }>;
  confidence: number;
  success: boolean;
  error?: string;
}

export interface TokenPriceInfo {
  contract: string;
  priceUSD: number;
  decimals: number;
  symbol?: string;
  lastUpdated: number;
}

export class WhaleDetectionService {
  private balanceStore: BalanceStore;
  private config: WhaleDetectionConfig;
  private tokenPriceCache: Map<string, TokenPriceInfo> = new Map();
  private priceRefreshInterval: number = 3600000; // 1 hour

  constructor(balanceStore: BalanceStore, config: WhaleDetectionConfig) {
    this.balanceStore = balanceStore;
    this.config = {
      smallWhaleThreshold: 10000,    // $10k
      mediumWhaleThreshold: 50000,   // $50k
      largeWhaleThreshold: 250000,   // $250k
      megaWhaleThreshold: 1000000,   // $1M
      ...config
    };
  }

  /**
   * Classify multiple addresses by whale status
   */
  async classifyAddresses(addresses: string[]): Promise<WhaleClassificationResult[]> {
    console.log(`🐋 Classifying ${addresses.length} addresses for whale status...`);
    
    const results: WhaleClassificationResult[] = [];
    
    // Process addresses in smaller batches to manage API calls
    const batchSize = 10;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      
      const batchPromises = batch.map(address => this.classifyAddress(address));
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Address classification failed:', result.reason);
          results.push({
            address: 'unknown',
            classification: 'none',
            totalValue: '0',
            tokenCount: 0,
            topTokens: [],
            confidence: 0,
            success: false,
            error: result.reason instanceof Error ? result.reason.message : 'Classification failed'
          });
        }
      }
      
      // Brief delay between batches
      await this.delay(100);
    }

    const successfulClassifications = results.filter(r => r.success);
    const whales = successfulClassifications.filter(r => r.classification !== 'none');
    
    console.log(`✅ Whale classification completed: ${whales.length} whales found out of ${successfulClassifications.length} addresses`);
    
    return results;
  }

  /**
   * Classify a single address by whale status
   */
  async classifyAddress(address: string): Promise<WhaleClassificationResult> {
    try {
      console.log(`🔍 Classifying address: ${address}`);

      // Get all balances for the address
      const balances = await this.balanceStore.getAddressBalances(address);
      
      if (!balances || Object.keys(balances).length === 0) {
        return {
          address,
          classification: 'none',
          totalValue: '0',
          tokenCount: 0,
          topTokens: [],
          confidence: 0.9, // High confidence that they have no tokens
          success: true
        };
      }

      // Calculate total USD value and get token details
      const tokenDetails = await this.calculateTokenValues(balances);
      const totalValueUSD = tokenDetails.reduce((sum, token) => sum + (token.valueUSD || 0), 0);

      // Classify based on total value
      const classification = this.getWhaleClassification(totalValueUSD);
      
      // Calculate confidence score based on price data availability
      const tokensWithPrices = tokenDetails.filter(t => t.valueUSD !== undefined).length;
      const confidence = tokensWithPrices / tokenDetails.length;

      // Sort tokens by value and get top tokens
      const topTokens = tokenDetails
        .sort((a, b) => (b.valueUSD || 0) - (a.valueUSD || 0))
        .slice(0, 10); // Top 10 tokens by value

      const result: WhaleClassificationResult = {
        address,
        classification,
        totalValue: tokenDetails.reduce((sum, token) => sum + BigInt(token.balance), BigInt(0)).toString(),
        totalValueUSD,
        tokenCount: tokenDetails.length,
        topTokens,
        confidence,
        success: true
      };

      if (classification !== 'none') {
        console.log(`🐋 Whale detected: ${address} (${classification}, $${totalValueUSD.toFixed(2)})`);
      }

      return result;

    } catch (error) {
      console.error(`Failed to classify address ${address}:`, error);
      return {
        address,
        classification: 'none',
        totalValue: '0',
        tokenCount: 0,
        topTokens: [],
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate USD values for token balances
   */
  private async calculateTokenValues(balances: Record<string, string>): Promise<Array<{
    contract: string;
    balance: string;
    valueUSD?: number;
  }>> {
    const tokenDetails = [];

    for (const [contract, balance] of Object.entries(balances)) {
      const tokenInfo = await this.getTokenPrice(contract);
      let valueUSD: number | undefined;

      if (tokenInfo) {
        // Convert balance to decimal amount and multiply by price
        const decimals = tokenInfo.decimals || 6;
        const balanceDecimal = Number(balance) / Math.pow(10, decimals);
        valueUSD = balanceDecimal * tokenInfo.priceUSD;
      }

      tokenDetails.push({
        contract,
        balance,
        valueUSD
      });
    }

    return tokenDetails;
  }

  /**
   * Get token price information (with caching)
   */
  private async getTokenPrice(contract: string): Promise<TokenPriceInfo | null> {
    // Check cache first
    const cached = this.tokenPriceCache.get(contract);
    if (cached && Date.now() - cached.lastUpdated < this.priceRefreshInterval) {
      return cached;
    }

    try {
      // For now, return mock price data
      // In production, this would integrate with:
      // - DEX price feeds (Alex, Bitflow, etc.)
      // - Token metadata for decimals
      // - Price aggregators
      
      const mockPriceInfo = await this.getMockTokenPrice(contract);
      
      if (mockPriceInfo) {
        this.tokenPriceCache.set(contract, mockPriceInfo);
        return mockPriceInfo;
      }

      return null;

    } catch (error) {
      console.warn(`Failed to get price for ${contract}:`, error);
      return null;
    }
  }

  /**
   * Mock token price function (replace with real price feeds)
   */
  private async getMockTokenPrice(contract: string): Promise<TokenPriceInfo | null> {
    // Mock price data for common tokens
    const mockPrices: Record<string, Partial<TokenPriceInfo>> = {
      // STX-like tokens
      'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.arkadiko-token': {
        priceUSD: 0.12,
        decimals: 6,
        symbol: 'DIKO'
      },
      'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.wrapped-stx-token': {
        priceUSD: 1.85, // STX price
        decimals: 6,
        symbol: 'wSTX'
      },
      'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.auto-alex': {
        priceUSD: 0.089,
        decimals: 8,
        symbol: 'AUTO-ALEX'
      }
    };

    const mockData = mockPrices[contract];
    if (mockData) {
      return {
        contract,
        priceUSD: mockData.priceUSD || 0,
        decimals: mockData.decimals || 6,
        symbol: mockData.symbol,
        lastUpdated: Date.now()
      };
    }

    // Default price for unknown tokens (very conservative)
    return {
      contract,
      priceUSD: 0.001, // Assume very low value for unknown tokens
      decimals: 6,
      lastUpdated: Date.now()
    };
  }

  /**
   * Determine whale classification based on USD value
   */
  private getWhaleClassification(totalValueUSD: number): WhaleClassificationResult['classification'] {
    if (totalValueUSD >= this.config.megaWhaleThreshold!) {
      return 'mega';
    } else if (totalValueUSD >= this.config.largeWhaleThreshold!) {
      return 'large';
    } else if (totalValueUSD >= this.config.mediumWhaleThreshold!) {
      return 'medium';
    } else if (totalValueUSD >= this.config.smallWhaleThreshold!) {
      return 'small';
    } else {
      return 'none';
    }
  }

  /**
   * Get whale statistics for all tracked addresses
   */
  async getWhaleStats(): Promise<{
    totalWhales: number;
    whalesByClassification: Record<string, number>;
    totalValueTracked: number;
    averageWhaleValue: number;
  }> {
    // This would query stored whale classifications
    // For now, return mock stats
    return {
      totalWhales: 0,
      whalesByClassification: {
        small: 0,
        medium: 0,
        large: 0,
        mega: 0
      },
      totalValueTracked: 0,
      averageWhaleValue: 0
    };
  }

  /**
   * Update whale detection configuration
   */
  updateConfig(newConfig: Partial<WhaleDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Whale detection config updated:', this.config);
  }

  /**
   * Clear price cache
   */
  clearPriceCache(): void {
    this.tokenPriceCache.clear();
    console.log('Price cache cleared');
  }

  /**
   * Get price cache statistics
   */
  getPriceCacheStats(): { size: number; tokens: string[] } {
    return {
      size: this.tokenPriceCache.size,
      tokens: Array.from(this.tokenPriceCache.keys())
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}