/**
 * Kraken Oracle Adapter - Implements IOracleAdapter using KrakenAdapter
 */

import { KrakenAdapter } from './kraken-adapter';
import type { IOracleAdapter } from './oracle-adapter.interface';
import type { PriceAdapterConfig } from './price-adapter.interface';

export class KrakenOracleAdapter implements IOracleAdapter {
  readonly name = 'kraken';
  
  private adapter: KrakenAdapter;

  constructor(config: PriceAdapterConfig = { timeoutMs: 5000 }) {
    this.adapter = new KrakenAdapter(config);
  }

  async getBtcPriceUsd(): Promise<number> {
    const result = await this.adapter.fetchPrice('BTC');
    
    if (!result.success || !result.data) {
      throw new Error(`Kraken BTC price failed: ${result.error}`);
    }
    
    return result.data.usdPrice;
  }

  async getTokenPriceUsd(tokenId: string): Promise<number | null> {
    // Kraken only supports BTC, and sBTC is handled specially
    if (tokenId === 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token') {
      // For sBTC, return BTC price since it's 1:1
      try {
        return await this.getBtcPriceUsd();
      } catch {
        return null;
      }
    }
    
    // No other tokens supported by Kraken adapter
    return null;
  }
}