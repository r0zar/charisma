/**
 * Intrinsic Value Engine - Redeemable Asset Pricing
 * 
 * Handles pricing of assets that have intrinsic value based on what they can be
 * redeemed for, rather than market discovery:
 * - Stablecoins: $1.00 redeemable value
 * - sBTC: Redeemable at BTC oracle price
 * - Subnet tokens: Redeemable at mainnet equivalent price
 * - LP tokens: Redeemable for underlying asset values
 */

import type { OracleEngine } from './oracle-engine';

export interface IntrinsicAsset {
    contractId: string;
    symbol: string;
    type: 'STABLECOIN' | 'SBTC' | 'SUBNET' | 'LP_TOKEN';
    decimals?: number;
    // For subnet tokens
    baseToken?: string;
    // For LP tokens
    underlyingTokens?: {
        tokenA: { contractId: string; symbol: string; decimals: number };
        tokenB: { contractId: string; symbol: string; decimals: number };
    };
}

export interface IntrinsicValueResult {
    contractId: string;
    symbol: string;
    usdValue: number;
    btcRatio: number;
    type: 'STABLECOIN' | 'SBTC' | 'SUBNET' | 'LP_TOKEN';
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
export interface IntrinsicTokenMetadataProvider {
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
export interface IntrinsicLpProvider {
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
export interface IntrinsicPriceProvider {
    getPrice(contractId: string): Promise<{ usdPrice: number } | null>;
}

/**
 * Known stablecoins (expandable list)
 */
const KNOWN_STABLECOINS = new Set([
    'USDC', 'USDT', 'DAI', 'BUSD', 'sUSDT', 'sUSDC'
]);

/**
 * sBTC contract ID
 */
const SBTC_CONTRACT_ID = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';

/**
 * Intrinsic Value Engine - Calculates redeemable asset values
 */
export class IntrinsicValueEngine {
    private oracleEngine: OracleEngine | null = null;
    private tokenMetadataProvider: IntrinsicTokenMetadataProvider | null = null;
    private lpProvider: IntrinsicLpProvider | null = null;
    private priceProvider: IntrinsicPriceProvider | null = null;

    constructor(
        oracleEngine?: OracleEngine,
        tokenMetadataProvider?: IntrinsicTokenMetadataProvider,
        lpProvider?: IntrinsicLpProvider,
        priceProvider?: IntrinsicPriceProvider
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
    setTokenMetadataProvider(provider: IntrinsicTokenMetadataProvider): void {
        this.tokenMetadataProvider = provider;
    }

    /**
     * Set the LP provider for liquidity pool data
     */
    setLpProvider(provider: IntrinsicLpProvider): void {
        this.lpProvider = provider;
    }

    /**
     * Set the price provider for underlying asset prices
     */
    setPriceProvider(provider: IntrinsicPriceProvider): void {
        this.priceProvider = provider;
    }

    /**
     * Calculate intrinsic value for an asset
     */
    async calculateIntrinsicValue(contractId: string): Promise<IntrinsicValueResult | null> {
        console.log(`[IntrinsicEngine] Calculating intrinsic value for ${contractId}`);

        // Detect asset type
        const assetType = await this.detectAssetType(contractId);
        if (!assetType) {
            console.log(`[IntrinsicEngine] ${contractId} is not a recognized intrinsic asset`);
            return null;
        }

        console.log(`[IntrinsicEngine] Detected ${contractId} as ${assetType.type}`);

        // Calculate value based on type
        switch (assetType.type) {
            case 'STABLECOIN':
                return await this.calculateStablecoinValue(assetType);
            case 'SBTC':
                return await this.calculateSbtcValue(assetType);
            case 'SUBNET':
                return await this.calculateSubnetTokenValue(assetType);
            case 'LP_TOKEN':
                return await this.calculateLpTokenValue(assetType);
            default:
                console.warn(`[IntrinsicEngine] Unknown asset type: ${assetType.type}`);
                return null;
        }
    }

    /**
     * Detect the type of intrinsic asset
     */
    private async detectAssetType(contractId: string): Promise<IntrinsicAsset | null> {
        // Check if it's sBTC
        if (contractId === SBTC_CONTRACT_ID) {
            return {
                contractId,
                symbol: 'sBTC',
                type: 'SBTC',
                decimals: 8
            };
        }

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

                    // Check for stablecoin by symbol
                    if (KNOWN_STABLECOINS.has(metadata.symbol)) {
                        return {
                            contractId,
                            symbol: metadata.symbol,
                            type: 'STABLECOIN',
                            decimals: metadata.decimals
                        };
                    }
                }
            } catch (error) {
                console.warn(`[IntrinsicEngine] Error getting metadata for ${contractId}:`, error);
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
                console.warn(`[IntrinsicEngine] Error checking LP status for ${contractId}:`, error);
            }
        }

        return null;
    }

    /**
     * Calculate stablecoin intrinsic value ($1.00)
     */
    private async calculateStablecoinValue(asset: IntrinsicAsset): Promise<IntrinsicValueResult> {
        console.log(`[IntrinsicEngine] Calculating stablecoin value for ${asset.symbol}`);

        // Get BTC price for ratio calculation
        let btcPrice = 100000; // Default fallback
        if (this.oracleEngine) {
            const btcData = await this.oracleEngine.getBtcPrice();
            if (btcData) {
                btcPrice = btcData.price;
            }
        }

        return {
            contractId: asset.contractId,
            symbol: asset.symbol,
            usdValue: 1.0,
            btcRatio: 1.0 / btcPrice,
            type: 'STABLECOIN',
            calculationMethod: 'Fixed $1.00 redeemable value',
            sourceData: {
                btcPrice
            },
            lastUpdated: Date.now()
        };
    }

    /**
     * Calculate sBTC intrinsic value (BTC oracle price)
     */
    private async calculateSbtcValue(asset: IntrinsicAsset): Promise<IntrinsicValueResult | null> {
        console.log(`[IntrinsicEngine] Calculating sBTC intrinsic value`);

        if (!this.oracleEngine) {
            console.error('[IntrinsicEngine] Oracle engine required for sBTC valuation');
            return null;
        }

        const btcData = await this.oracleEngine.getBtcPrice();
        if (!btcData) {
            console.error('[IntrinsicEngine] Failed to get BTC price from oracle');
            return null;
        }

        return {
            contractId: asset.contractId,
            symbol: asset.symbol,
            usdValue: btcData.price,
            btcRatio: 1.0,
            type: 'SBTC',
            calculationMethod: 'BTC oracle feed (redeemable for BTC)',
            sourceData: {
                btcPrice: btcData.price
            },
            lastUpdated: Date.now()
        };
    }

    /**
     * Calculate subnet token intrinsic value (inherits from base token)
     */
    private async calculateSubnetTokenValue(asset: IntrinsicAsset): Promise<IntrinsicValueResult | null> {
        console.log(`[IntrinsicEngine] Calculating subnet token value for ${asset.symbol}`);

        if (!asset.baseToken) {
            console.error('[IntrinsicEngine] No base token specified for subnet token');
            return null;
        }

        if (!this.priceProvider) {
            console.error('[IntrinsicEngine] Price provider required for subnet token valuation');
            return null;
        }

        // Get base token price
        const basePrice = await this.priceProvider.getPrice(asset.baseToken);
        if (!basePrice) {
            console.error(`[IntrinsicEngine] Failed to get price for base token: ${asset.baseToken}`);
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
     * Calculate LP token intrinsic value (underlying asset values)
     */
    private async calculateLpTokenValue(asset: IntrinsicAsset): Promise<IntrinsicValueResult | null> {
        console.log(`[IntrinsicEngine] Calculating LP token intrinsic value for ${asset.contractId}`);

        if (!asset.underlyingTokens || !this.lpProvider || !this.priceProvider) {
            console.error('[IntrinsicEngine] LP provider and price provider required for LP token valuation');
            return null;
        }

        try {
            // Get remove liquidity quote for 1 LP token
            const lpDecimals = 6; // Default, should get from metadata
            const lpAmountMicroUnits = Math.pow(10, lpDecimals);

            const quoteResult = await this.lpProvider.getRemoveLiquidityQuote(asset.contractId, lpAmountMicroUnits);
            if (!quoteResult.success || !quoteResult.quote) {
                console.error(`[IntrinsicEngine] Failed to get remove liquidity quote: ${quoteResult.error}`);
                return null;
            }

            const { dx, dy } = quoteResult.quote;

            // Get prices for underlying tokens
            const priceA = await this.priceProvider.getPrice(asset.underlyingTokens.tokenA.contractId);
            const priceB = await this.priceProvider.getPrice(asset.underlyingTokens.tokenB.contractId);

            if (!priceA || !priceB) {
                console.error('[IntrinsicEngine] Failed to get prices for underlying LP tokens');
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

            console.log(`[IntrinsicEngine] LP intrinsic value: ${tokenAAmount.toFixed(6)} ${asset.underlyingTokens.tokenA.symbol} + ${tokenBAmount.toFixed(6)} ${asset.underlyingTokens.tokenB.symbol} = $${totalUsdValue.toFixed(6)}`);

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
            console.error(`[IntrinsicEngine] Error calculating LP token value:`, error);
            return null;
        }
    }

    /**
     * Calculate intrinsic values for multiple assets
     */
    async calculateMultipleIntrinsicValues(contractIds: string[]): Promise<Map<string, IntrinsicValueResult>> {
        console.log(`[IntrinsicEngine] Calculating intrinsic values for ${contractIds.length} assets`);

        const results = new Map<string, IntrinsicValueResult>();

        // Process in batches to avoid overwhelming dependencies
        const batchSize = 5;
        for (let i = 0; i < contractIds.length; i += batchSize) {
            const batch = contractIds.slice(i, i + batchSize);

            const promises = batch.map(async (contractId) => {
                const result = await this.calculateIntrinsicValue(contractId);
                if (result) {
                    results.set(contractId, result);
                }
            });

            await Promise.all(promises);
        }

        console.log(`[IntrinsicEngine] Calculated intrinsic values for ${results.size}/${contractIds.length} assets`);
        return results;
    }

    /**
     * Check if a token has intrinsic value
     */
    async hasIntrinsicValue(contractId: string): Promise<boolean> {
        const assetType = await this.detectAssetType(contractId);
        return assetType !== null;
    }

    /**
     * Get all known stablecoins
     */
    getKnownStablecoins(): string[] {
        return Array.from(KNOWN_STABLECOINS);
    }

    /**
     * Check if a symbol is a known stablecoin
     */
    isKnownStablecoin(symbol: string): boolean {
        return KNOWN_STABLECOINS.has(symbol);
    }
}