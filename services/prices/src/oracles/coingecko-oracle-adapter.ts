/**
 * CoinGecko Oracle Adapter - Implements IOracleAdapter using CoinGeckoAdapter
 */

import { CoinGeckoAdapter } from './coingecko-adapter';
import type { IOracleAdapter } from './oracle-adapter.interface';
import type { PriceAdapterConfig } from './price-adapter.interface';

export class CoinGeckoOracleAdapter implements IOracleAdapter {
  readonly name = 'coingecko';
  
  private adapter: CoinGeckoAdapter;

  constructor(config: PriceAdapterConfig = { timeoutMs: 5000 }) {
    this.adapter = new CoinGeckoAdapter(config);
  }

  async getBtcPriceUsd(): Promise<number> {
    const result = await this.adapter.fetchPrice('BTC');
    
    if (!result.success || !result.data) {
      throw new Error(`CoinGecko BTC price failed: ${result.error}`);
    }
    
    return result.data.usdPrice;
  }

  async getTokenPriceUsd(tokenId: string): Promise<number | null> {
    // CoinGecko only supports BTC, and sBTC is handled specially
    if (tokenId === 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token') {
      // For sBTC, return BTC price since it's 1:1
      try {
        return await this.getBtcPriceUsd();
      } catch {
        return null;
      }
    }
    
    // No other tokens supported by CoinGecko adapter
    return null;
  }
}