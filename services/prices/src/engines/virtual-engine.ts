/**
 * Virtual Engine - Virtual Asset Pricing
 * 
 * Handles pricing of assets calculated from existing oracle/market data:
 * - Subnet tokens: Calculated from mainnet equivalent price
 * - LP tokens: Calculated from underlying asset values
 * 
 * Note: Oracle assets (BTC, sBTC, stablecoins) are handled by Oracle Engine
 */

import type { OracleEngine } from './oracle-engine';

export interface VirtualAsset {
    contractId: string;
    symbol: string;
    type: 'SUBNET' | 'LP_TOKEN';
    decimals?: number;
    // For subnet tokens
    baseToken?: string;
    // For LP tokens
    underlyingTokens?: {
        tokenA: { contractId: string; symbol: string; decimals: number };
        tokenB: { contractId: string; symbol: string; decimals: number };
    };
}

export interface VirtualValueResult {
    contractId: string;
    symbol: string;
    usdValue: number;
    btcRatio: number;
    type: 'SUBNET' | 'LP_TOKEN';
    calculationMethod: string;
    sourceData?: {
        btcPrice?: number;
        baseTokenPrice?: number;
        underlyingAssetValues?: {
            tokenA: { amount: number; usdValue: number };
            tokenB: { amount: number; usdValue: number };
        };
    };
    lastUpdated: number;
}

/**
 * Token metadata provider for detecting asset types
 */
export interface VirtualTokenMetadataProvider {
    getTokenMetadata(contractId: string): Promise<{
        contractId: string;
        type: string;
        symbol: string;
        decimals?: number;
        base?: string; // For subnet tokens
    } | null>;
}

/**
 * LP token provider for getting underlying asset composition
 */
export interface VirtualLpProvider {
    getAllVaultData(): Promise<Array<{
        contractId: string;
        type: string;
        tokenA?: { contractId: string; symbol: string; decimals: number };
        tokenB?: { contractId: string; symbol: string; decimals: number };
    }>>;
    getRemoveLiquidityQuote(contractId: string, amount: number): Promise<{
        success: boolean;
        quote?: { dx: number; dy: number };
        error?: string;
    }>;
}

/**
 * Price provider for getting prices of underlying assets
 */
export interface VirtualPriceProvider {
    getPrice(contractId: string): Promise<{ usdPrice: number } | null>;
}



/**
 * Virtual Value Engine - Calculates redeemable asset values
 */
export class VirtualEngine {
    private oracleEngine: OracleEngine | null = null;
    private tokenMetadataProvider: VirtualTokenMetadataProvider | null = null;
    private lpProvider: VirtualLpProvider | null = null;
    private priceProvider: VirtualPriceProvider | null = null;

    constructor(
        oracleEngine?: OracleEngine,
        tokenMetadataProvider?: VirtualTokenMetadataProvider,
        lpProvider?: VirtualLpProvider,
        priceProvider?: VirtualPriceProvider
    ) {
        this.oracleEngine = oracleEngine || null;
        this.tokenMetadataProvider = tokenMetadataProvider || null;
        this.lpProvider = lpProvider || null;
        this.priceProvider = priceProvider || null;
    }

    /**
     * Set the oracle engine for BTC price feeds
     */
    setOracleEngine(engine: OracleEngine): void {
        this.oracleEngine = engine;
    }

    /**
     * Set the token metadata provider
     */
    setTokenMetadataProvider(provider: VirtualTokenMetadataProvider): void {
        this.tokenMetadataProvider = provider;
    }

    /**
     * Set the LP provider for liquidity pool data
     */
    setLpProvider(provider: VirtualLpProvider): void {
        this.lpProvider = provider;
    }

    /**
     * Set the price provider for underlying asset prices
     */
    setPriceProvider(provider: VirtualPriceProvider): void {
        this.priceProvider = provider;
    }

    /**
     * Calculate virtual value for an asset
     */
    async calculateVirtualValue(contractId: string): Promise<VirtualValueResult | null> {
        console.log(`[VirtualEngine] Calculating virtual value for ${contractId}`);

        // Detect asset type
        const assetType = await this.detectAssetType(contractId);
        if (!assetType) {
            console.log(`[VirtualEngine] ${contractId} is not a recognized virtual asset`);
            return null;
        }

        console.log(`[VirtualEngine] Detected ${contractId} as ${assetType.type}`);

        // Calculate value based on type
        switch (assetType.type) {
            case 'SUBNET':
                return await this.calculateSubnetTokenValue(assetType);
            case 'LP_TOKEN':
                return await this.calculateLpTokenValue(assetType);
            default:
                console.warn(`[VirtualEngine] Unknown asset type: ${assetType.type}`);
                return null;
        }
    }

    /**
     * Detect the type of virtual asset
     */
    private async detectAssetType(contractId: string): Promise<VirtualAsset | null> {

        // Check token metadata if available
        if (this.tokenMetadataProvider) {
            try {
                const metadata = await this.tokenMetadataProvider.getTokenMetadata(contractId);
                if (metadata) {
                    // Check for subnet token
                    if (metadata.type === 'SUBNET' && metadata.base) {
                        return {
                            contractId,
                            symbol: metadata.symbol,
                            type: 'SUBNET',
                            decimals: metadata.decimals,
                            baseToken: metadata.base
                        };
                    }

                }
            } catch (error) {
                console.warn(`[VirtualEngine] Error getting metadata for ${contractId}:`, error);
            }
        }

        // Check if it's an LP token
        if (this.lpProvider) {
            try {
                const vaults = await this.lpProvider.getAllVaultData();
                const vault = vaults.find(v => v.contractId === contractId && v.type === 'POOL');
                if (vault && vault.tokenA && vault.tokenB) {
                    return {
                        contractId,
                        symbol: 'LP', // Generic symbol, should be improved with metadata
                        type: 'LP_TOKEN',
                        underlyingTokens: {
                            tokenA: vault.tokenA,
                            tokenB: vault.tokenB
                        }
                    };
                }
            } catch (error) {
                console.warn(`[VirtualEngine] Error checking LP status for ${contractId}:`, error);
            }
        }

        return null;
    }



    /**
     * Calculate subnet token virtual value (inherits from base token)
     */
    private async calculateSubnetTokenValue(asset: VirtualAsset): Promise<VirtualValueResult | null> {
        console.log(`[VirtualEngine] Calculating subnet token value for ${asset.symbol}`);

        if (!asset.baseToken) {
            console.error('[VirtualEngine] No base token specified for subnet token');
            return null;
        }

        if (!this.priceProvider) {
            console.error('[VirtualEngine] Price provider required for subnet token valuation');
            return null;
        }

        // Get base token price
        const basePrice = await this.priceProvider.getPrice(asset.baseToken);
        if (!basePrice) {
            console.error(`[VirtualEngine] Failed to get price for base token: ${asset.baseToken}`);
            return null;
        }

        // Get BTC price for ratio calculation
        let btcPrice = 100000;
        if (this.oracleEngine) {
            const btcData = await this.oracleEngine.getBtcPrice();
            if (btcData) {
                btcPrice = btcData.price;
            }
        }

        return {
            contractId: asset.contractId,
            symbol: asset.symbol,
            usdValue: basePrice.usdPrice,
            btcRatio: basePrice.usdPrice / btcPrice,
            type: 'SUBNET',
            calculationMethod: `Inherits from mainnet base token: ${asset.baseToken}`,
            sourceData: {
                btcPrice,
                baseTokenPrice: basePrice.usdPrice
            },
            lastUpdated: Date.now()
        };
    }

    /**
     * Calculate LP token virtual value (underlying asset values)
     */
    private async calculateLpTokenValue(asset: VirtualAsset): Promise<VirtualValueResult | null> {
        console.log(`[VirtualEngine] Calculating LP token virtual value for ${asset.contractId}`);

        if (!asset.underlyingTokens || !this.lpProvider || !this.priceProvider) {
            console.error('[VirtualEngine] LP provider and price provider required for LP token valuation');
            return null;
        }

        try {
            // Get remove liquidity quote for 1 LP token
            const lpDecimals = 6; // Default, should get from metadata
            const lpAmountMicroUnits = Math.pow(10, lpDecimals);

            const quoteResult = await this.lpProvider.getRemoveLiquidityQuote(asset.contractId, lpAmountMicroUnits);
            if (!quoteResult.success || !quoteResult.quote) {
                console.error(`[VirtualEngine] Failed to get remove liquidity quote: ${quoteResult.error}`);
                return null;
            }

            const { dx, dy } = quoteResult.quote;

            // Get prices for underlying tokens
            const priceA = await this.priceProvider.getPrice(asset.underlyingTokens.tokenA.contractId);
            const priceB = await this.priceProvider.getPrice(asset.underlyingTokens.tokenB.contractId);

            if (!priceA || !priceB) {
                console.error('[VirtualEngine] Failed to get prices for underlying LP tokens');
                return null;
            }

            // Convert amounts to decimal
            const tokenADecimals = asset.underlyingTokens.tokenA.decimals;
            const tokenBDecimals = asset.underlyingTokens.tokenB.decimals;

            const tokenAAmount = dx / Math.pow(10, tokenADecimals);
            const tokenBAmount = dy / Math.pow(10, tokenBDecimals);

            // Calculate USD values
            const tokenAValue = tokenAAmount * priceA.usdPrice;
            const tokenBValue = tokenBAmount * priceB.usdPrice;
            const totalUsdValue = tokenAValue + tokenBValue;

            // Get BTC price for ratio calculation
            let btcPrice = 100000;
            if (this.oracleEngine) {
                const btcData = await this.oracleEngine.getBtcPrice();
                if (btcData) {
                    btcPrice = btcData.price;
                }
            }

            console.log(`[VirtualEngine] LP virtual value: ${tokenAAmount.toFixed(6)} ${asset.underlyingTokens.tokenA.symbol} + ${tokenBAmount.toFixed(6)} ${asset.underlyingTokens.tokenB.symbol} = $${totalUsdValue.toFixed(6)}`);

            return {
                contractId: asset.contractId,
                symbol: asset.symbol,
                usdValue: totalUsdValue,
                btcRatio: totalUsdValue / btcPrice,
                type: 'LP_TOKEN',
                calculationMethod: 'Remove liquidity quote of underlying assets',
                sourceData: {
                    btcPrice,
                    underlyingAssetValues: {
                        tokenA: { amount: tokenAAmount, usdValue: tokenAValue },
                        tokenB: { amount: tokenBAmount, usdValue: tokenBValue }
                    }
                },
                lastUpdated: Date.now()
            };

        } catch (error) {
            console.error(`[VirtualEngine] Error calculating LP token value:`, error);
            return null;
        }
    }

    /**
     * Calculate virtual values for multiple assets
     */
    async calculateMultipleVirtualValues(contractIds: string[]): Promise<Map<string, VirtualValueResult>> {
        console.log(`[VirtualEngine] Calculating virtual values for ${contractIds.length} assets`);

        const results = new Map<string, VirtualValueResult>();

        // Process in batches to avoid overwhelming dependencies
        const batchSize = 5;
        for (let i = 0; i < contractIds.length; i += batchSize) {
            const batch = contractIds.slice(i, i + batchSize);

            const promises = batch.map(async (contractId) => {
                const result = await this.calculateVirtualValue(contractId);
                if (result) {
                    results.set(contractId, result);
                }
            });

            await Promise.all(promises);
        }

        console.log(`[VirtualEngine] Calculated virtual values for ${results.size}/${contractIds.length} assets`);
        return results;
    }

    /**
     * Check if a token has virtual value
     */
    async hasVirtualValue(contractId: string): Promise<boolean> {
        const assetType = await this.detectAssetType(contractId);
        return assetType !== null;
    }

}