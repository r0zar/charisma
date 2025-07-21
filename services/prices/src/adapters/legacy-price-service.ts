/**
 * Legacy Price Service Adapter
 * 
 * Provides backward compatibility with the old price service interface
 * by wrapping the new three-engine orchestrator.
 */

import { PriceServiceOrchestrator } from '../orchestrator/price-service-orchestrator';
import { OracleEngine } from '../engines/oracle-engine';
import { CpmmEngine } from '../engines/cpmm-engine';
import { VirtualEngine } from '../engines/virtual-engine';
import type { TokenPriceData } from '../shared/types';

export interface LegacyPriceServiceConfig {
  btcOracle?: {
    sources?: string[];
    circuitBreaker?: {
      failureThreshold?: number;
      recoveryTimeout?: number;
    };
  };
  storage?: {
    enabled?: boolean;
    blobToken?: string;
  };
}

export interface LegacyPriceResult {
  success: boolean;
  price?: TokenPriceData;
  error?: string;
}

export interface LegacyBulkPriceResult {
  success: boolean;
  prices: Map<string, TokenPriceData>;
  errors: Map<string, string>;
}

/**
 * Legacy adapter that wraps the new orchestrator
 */
export class LegacyPriceService {
  private orchestrator: PriceServiceOrchestrator;
  private initialized = false;

  constructor(private config: LegacyPriceServiceConfig = {}) {
    this.orchestrator = new PriceServiceOrchestrator();
  }

  /**
   * Initialize with engines - called automatically if needed
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // Use orchestrator's auto-initialization with default providers
    await this.orchestrator.initializeWithDefaults({
      blobToken: this.config.storage?.blobToken
    });

    this.initialized = true;
  }

  /**
   * Calculate price for a single token (legacy interface)
   */
  async calculateTokenPrice(contractId: string): Promise<LegacyPriceResult> {
    try {
      await this.ensureInitialized();
      
      const result = await this.orchestrator.calculateTokenPrice(contractId);
      
      if (result.success && result.price) {
        return {
          success: true,
          price: result.price
        };
      } else {
        return {
          success: false,
          error: result.error || 'Price calculation failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate prices for multiple tokens (legacy interface)
   */
  async calculateMultipleTokenPrices(contractIds: string[]): Promise<LegacyBulkPriceResult> {
    try {
      await this.ensureInitialized();
      
      const result = await this.orchestrator.calculateMultipleTokenPrices(contractIds);
      
      return {
        success: true,
        prices: result.prices,
        errors: result.errors
      };
    } catch (error) {
      return {
        success: false,
        prices: new Map(),
        errors: new Map([['global', error instanceof Error ? error.message : 'Unknown error']])
      };
    }
  }

  /**
   * Set pool data provider (for CPMM engine)
   */
  setPoolDataProvider(provider: any): void {
    if (this.orchestrator.getCpmmEngine()) {
      this.orchestrator.getCpmmEngine()!.setPoolDataProvider(provider);
    }
  }

  /**
   * Set liquidity provider (for intrinsic engine)
   */
  setLiquidityProvider(provider: any): void {
    if (this.orchestrator.getVirtualEngine()) {
      this.orchestrator.getVirtualEngine()!.setLpProvider(provider);
    }
  }

  /**
   * Set token metadata provider (for intrinsic engine)
   */
  setTokenMetadataProvider(provider: any): void {
    if (this.orchestrator.getVirtualEngine()) {
      this.orchestrator.getVirtualEngine()!.setTokenMetadataProvider(provider);
    }
  }
}

// Export for backward compatibility
export default LegacyPriceService;