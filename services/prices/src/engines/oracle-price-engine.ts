/**
 * Oracle Price Engine - Simplified design that works directly with oracle adapters
 * 
 * Removes the strategy abstraction and aggregates oracle adapters directly
 */

import type { IOracleAdapter } from '../oracles/oracle-adapter.interface';
import type { SimpleBlobStorage, TokenPriceEntry } from '../price-series/simple-blob-storage';

export interface OraclePriceResult {
  // Simple price data
  price: {
    tokensOut: bigint; // Amount of tokens for standard BTC amount
    usdPrice: number; // USD price per token
    sbtcRatio: number; // Token to sBTC ratio
  };

  // Oracle results
  oracleResults: {
    adapterName: string;
    success: boolean;
    price?: number;
    error?: string;
  }[];

  // Essential metadata
  metadata: {
    btcAmount: bigint; // Base BTC amount used for pricing
    btcPriceUsd: number; // BTC price used for USD conversion
    timestamp: number;
    tokenId: string;
  };
}

export interface OraclePriceEngineConfig {
  standardBtcAmount: bigint; // Default: 1M satoshis (0.01 BTC)
  timeoutMs: number; // Default: 10000ms
  requireMinAdapters: number; // Minimum adapters that must succeed, default: 1
}

export const defaultOracleConfig: OraclePriceEngineConfig = {
  standardBtcAmount: BigInt(1_000_000), // 0.01 BTC
  timeoutMs: 10000,
  requireMinAdapters: 1
};

// sBTC contract ID - special case for 1:1 BTC conversion
export const SBTC_CONTRACT_ID = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';

export interface IOraclePriceEngine {
  registerAdapter(adapter: IOracleAdapter): void;
  getAdapters(): IOracleAdapter[];
  getPrice(tokenId: string): Promise<OraclePriceResult | null>;
  getMultiplePrices(tokenIds: string[]): Promise<Map<string, OraclePriceResult>>;
  saveSnapshot(prices: Map<string, OraclePriceResult>): Promise<void>;
  getStats(): {
    totalAdapters: number;
    lastCalculationTime?: number;
  };
}

export class OraclePriceEngine implements IOraclePriceEngine {
  private adapters: IOracleAdapter[] = [];
  private lastCalculationTime?: number;

  constructor(
    private config: OraclePriceEngineConfig = defaultOracleConfig,
    private blobStorage?: SimpleBlobStorage
  ) { }

  registerAdapter(adapter: IOracleAdapter): void {
    this.adapters.push(adapter);
    console.log(`[OraclePriceEngine] Registered adapter: ${adapter.name}`);
  }

  getAdapters(): IOracleAdapter[] {
    return [...this.adapters];
  }

  async getPrice(tokenId: string): Promise<OraclePriceResult | null> {
    console.log(`[OraclePriceEngine] Getting price for ${tokenId}`);

    // Check blob storage first
    if (this.blobStorage) {
      try {
        const storedPrice = await this.blobStorage.getCurrentPrice(tokenId);
        if (storedPrice) {
          console.log(`[OraclePriceEngine] Returning stored price from blob storage for ${tokenId}`);
          return await this.convertStoredPriceToOracleResult(storedPrice);
        }
      } catch (error) {
        console.warn(`[OraclePriceEngine] Error checking blob storage for ${tokenId}:`, error);
      }
    }

    // Special handling for sBTC - it's 1:1 with BTC
    if (tokenId === SBTC_CONTRACT_ID) {
      return await this.getPriceSbtc();
    }

    // For other tokens, try to get USD price from adapters
    return await this.getPriceFromAdapters(tokenId);
  }

  async getMultiplePrices(tokenIds: string[]): Promise<Map<string, OraclePriceResult>> {
    console.log(`[OraclePriceEngine] Getting prices for ${tokenIds.length} tokens`);

    const results = new Map<string, OraclePriceResult>();

    // Process in parallel for better performance
    const promises = tokenIds.map(async (tokenId) => {
      const result = await this.getPrice(tokenId);
      if (result) {
        results.set(tokenId, result);
      }
    });

    await Promise.all(promises);

    console.log(`[OraclePriceEngine] Calculated prices for ${results.size}/${tokenIds.length} tokens`);
    return results;
  }

  async saveSnapshot(prices: Map<string, OraclePriceResult>): Promise<void> {
    if (!this.blobStorage) {
      console.warn('[OraclePriceEngine] No blob storage configured for saving snapshots');
      return;
    }

    try {
      // Convert OraclePriceResult to PriceResult format expected by blob storage
      const convertedPrices = new Map();

      for (const [tokenId, oracleResult] of prices) {
        // Convert to the format expected by SimpleBlobStorage
        const priceResult = {
          averagePrice: {
            tokensOut: oracleResult.price.tokensOut,
            usdPrice: oracleResult.price.usdPrice
          },
          strategyResults: [{
            strategyName: 'oracle',
            quotes: [{
              btcAmount: oracleResult.metadata.btcAmount,
              tokensOut: oracleResult.price.tokensOut
            }]
          }],
          metadata: oracleResult.metadata
        };

        convertedPrices.set(tokenId, priceResult);
      }

      await this.blobStorage.saveSnapshot(convertedPrices);
      console.log(`[OraclePriceEngine] Saved snapshot with ${prices.size} tokens`);
    } catch (error) {
      console.warn(`[OraclePriceEngine] Error saving snapshot:`, error);
    }
  }

  getStats() {
    return {
      totalAdapters: this.adapters.length,
      lastCalculationTime: this.lastCalculationTime
    };
  }

  /**
   * Get sBTC price (special case - 1:1 with BTC)
   */
  private async getPriceSbtc(): Promise<OraclePriceResult | null> {
    console.log(`[OraclePriceEngine] Getting sBTC price (1:1 with BTC)`);

    const oracleResults: { adapterName: string; success: boolean; price?: number; error?: string }[] = [];
    let btcPriceUsd = 0;
    let successCount = 0;

    // Try each adapter to get BTC price
    for (const adapter of this.adapters) {
      try {
        const price = await adapter.getBtcPriceUsd();
        oracleResults.push({
          adapterName: adapter.name,
          success: true,
          price
        });
        btcPriceUsd += price;
        successCount++;
      } catch (error) {
        oracleResults.push({
          adapterName: adapter.name,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (successCount === 0) {
      console.warn(`[OraclePriceEngine] No adapters succeeded for BTC price`);
      return null;
    }

    // Average the successful results
    btcPriceUsd = btcPriceUsd / successCount;

    // For sBTC, tokensOut equals btcAmount (1:1 ratio)
    const tokensOut = this.config.standardBtcAmount;
    const usdPrice = btcPriceUsd; // sBTC has same USD price as BTC

    this.lastCalculationTime = Date.now();

    return {
      price: {
        tokensOut,
        usdPrice,
        sbtcRatio: 1.0 // 1:1 with sBTC
      },
      oracleResults,
      metadata: {
        btcAmount: this.config.standardBtcAmount,
        btcPriceUsd,
        timestamp: Date.now(),
        tokenId: SBTC_CONTRACT_ID
      }
    };
  }

  /**
   * Get price from adapters for non-sBTC tokens
   */
  private async getPriceFromAdapters(tokenId: string): Promise<OraclePriceResult | null> {
    console.log(`[OraclePriceEngine] Getting price from adapters for ${tokenId}`);

    const oracleResults: { adapterName: string; success: boolean; price?: number; error?: string }[] = [];
    let totalUsdPrice = 0;
    let successCount = 0;
    let btcPriceUsd = 0;

    // Try each adapter
    for (const adapter of this.adapters) {
      try {
        const tokenPrice = await adapter.getTokenPriceUsd(tokenId);
        if (tokenPrice !== null) {
          oracleResults.push({
            adapterName: adapter.name,
            success: true,
            price: tokenPrice
          });
          totalUsdPrice += tokenPrice;
          successCount++;

          // Also get BTC price for USD conversion
          if (btcPriceUsd === 0) {
            try {
              btcPriceUsd = await adapter.getBtcPriceUsd();
            } catch {
              // Ignore BTC price errors from individual adapters
            }
          }
        } else {
          oracleResults.push({
            adapterName: adapter.name,
            success: false,
            error: 'Token not supported or no price available'
          });
        }
      } catch (error) {
        oracleResults.push({
          adapterName: adapter.name,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (successCount < this.config.requireMinAdapters) {
      console.warn(`[OraclePriceEngine] Only ${successCount} adapters succeeded for ${tokenId}, minimum required: ${this.config.requireMinAdapters}`);
      return null;
    }

    // Average the successful results
    const avgUsdPrice = totalUsdPrice / successCount;

    // Get BTC price if we didn't get it yet
    if (btcPriceUsd === 0) {
      try {
        btcPriceUsd = await this.getBtcPriceFromAnyAdapter();
      } catch (error) {
        console.warn(`[OraclePriceEngine] Failed to get BTC price for USD conversion:`, error);
        btcPriceUsd = 100000; // Fallback BTC price
      }
    }

    // Calculate tokens out for standard BTC amount
    const btcValue = Number(this.config.standardBtcAmount) / 100_000_000; // Convert satoshis to BTC
    const usdValue = btcValue * btcPriceUsd;
    const tokensOut = BigInt(Math.floor(usdValue / avgUsdPrice * 100_000_000)); // Assume 8 decimals

    // Calculate sBTC ratio
    const sbtcRatio = avgUsdPrice / btcPriceUsd;

    this.lastCalculationTime = Date.now();

    return {
      price: {
        tokensOut,
        usdPrice: avgUsdPrice,
        sbtcRatio
      },
      oracleResults,
      metadata: {
        btcAmount: this.config.standardBtcAmount,
        btcPriceUsd,
        timestamp: Date.now(),
        tokenId
      }
    };
  }

  /**
   * Get BTC price from any available adapter
   */
  private async getBtcPriceFromAnyAdapter(): Promise<number> {
    for (const adapter of this.adapters) {
      try {
        return await adapter.getBtcPriceUsd();
      } catch {
        continue;
      }
    }
    throw new Error('No adapters could provide BTC price');
  }

  /**
   * Convert stored blob price to OraclePriceResult
   */
  private async convertStoredPriceToOracleResult(stored: TokenPriceEntry): Promise<OraclePriceResult> {
    return {
      price: {
        tokensOut: stored.quotes[0]?.tokensOut || BigInt(0),
        usdPrice: stored.usdPrice,
        sbtcRatio: stored.sbtcRatio
      },
      oracleResults: [{
        adapterName: 'blob-storage',
        success: true,
        price: stored.usdPrice
      }],
      metadata: {
        btcAmount: stored.quotes[0]?.btcAmount || this.config.standardBtcAmount,
        btcPriceUsd: stored.usdPrice / stored.sbtcRatio, // Derive BTC price
        timestamp: stored.timestamp,
        tokenId: stored.tokenId
      }
    };
  }
}