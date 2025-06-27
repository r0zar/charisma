import { Vault, getAllVaultData } from '@/lib/pool-service';
import { getRemoveLiquidityQuote } from '@/app/actions';

/**
 * LP Token pricing analysis results
 */
export interface LpTokenPriceAnalysis {
    /** Market price of the LP token (if tradable), null if not available */
    marketPrice: number | null;
    /** Intrinsic value based on underlying assets per LP token */
    intrinsicValue: number | null;
    /** Percentage difference between market and intrinsic value */
    priceDifference: number | null;
    /** Absolute difference in USD */
    absoluteDifference: number | null;
    /** Whether this represents an arbitrage opportunity */
    isArbitrageOpportunity: boolean;
    /** Individual asset values contributing to intrinsic value */
    assetBreakdown: {
        tokenA: { symbol: string; value: number; price: number; amount: number };
        tokenB: { symbol: string; value: number; price: number; amount: number };
    } | null;
    /** Total supply of LP tokens */
    totalSupply: number | null;
}

/**
 * Calculate the intrinsic value of an LP token using remove liquidity quotes
 * This uses actual contract logic instead of geometric mean estimation
 * @param vault - The vault/pool data
 * @param prices - Token prices keyed by contract ID
 * @param lpTokenAmount - Amount of LP tokens to calculate value for (default: 1)
 * @returns Intrinsic value per LP token or null if calculation not possible
 */
export const calculateLpIntrinsicValueFromVault = async (
    vault: Vault,
    prices: Record<string, number>,
    lpTokenAmount: number = 1
): Promise<number | null> => {
    if (!vault.tokenA || !vault.tokenB) {
        console.warn(`[LP Calculator] Missing token info for vault: ${vault.contractId}`);
        return null;
    }

    const priceA = prices[vault.tokenA.contractId];
    const priceB = prices[vault.tokenB.contractId];

    if (!priceA || !priceB) {
        console.warn(`[LP Calculator] Missing prices for vault ${vault.contractId}: tokenA=${priceA}, tokenB=${priceB}`);
        return null;
    }

    try {
        // Use actual remove liquidity quote to get accurate token amounts
        // Convert lpTokenAmount to microunits for the quote
        const lpDecimals = vault.decimals || 6;
        const lpAmountMicroUnits = Math.round(lpTokenAmount * Math.pow(10, lpDecimals));
        
        console.log(`[LP Calculator] Getting remove liquidity quote for ${vault.contractId}, amount: ${lpAmountMicroUnits}`);
        
        const quoteResult = await getRemoveLiquidityQuote(vault.contractId, lpAmountMicroUnits);
        
        if (!quoteResult.success || !quoteResult.quote) {
            console.warn(`[LP Calculator] Failed to get remove liquidity quote for ${vault.contractId}: ${quoteResult.error}`);
            return null;
        }

        const { dx, dy } = quoteResult.quote;
        
        // Convert token amounts from microunits to display units
        const tokenADecimals = vault.tokenA.decimals || 6;
        const tokenBDecimals = vault.tokenB.decimals || 6;
        
        const tokenAAmount = dx / Math.pow(10, tokenADecimals);
        const tokenBAmount = dy / Math.pow(10, tokenBDecimals);

        // Calculate total value in USD
        const totalValue = (tokenAAmount * priceA) + (tokenBAmount * priceB);
        
        console.log(`[LP Calculator] ${vault.contractId}: ${lpTokenAmount} LP = ${tokenAAmount.toFixed(6)} ${vault.tokenA.symbol} + ${tokenBAmount.toFixed(6)} ${vault.tokenB.symbol} = $${totalValue.toFixed(6)}`);
        
        return totalValue;

    } catch (error) {
        console.error(`[LP Calculator] Error calculating intrinsic value for ${vault.contractId}:`, error);
        return null;
    }
};

/**
 * Calculate detailed asset breakdown for LP token value using remove liquidity quotes
 * @param vault - The vault/pool data
 * @param prices - Token prices keyed by contract ID
 * @param lpTokenAmount - Amount of LP tokens to analyze (default: 1)
 * @returns Asset breakdown or null if calculation not possible
 */
export const calculateAssetBreakdown = async (
    vault: Vault,
    prices: Record<string, number>,
    lpTokenAmount: number = 1
): Promise<LpTokenPriceAnalysis['assetBreakdown']> => {
    if (!vault.tokenA || !vault.tokenB) {
        return null;
    }

    const priceA = prices[vault.tokenA.contractId];
    const priceB = prices[vault.tokenB.contractId];

    if (!priceA || !priceB) {
        return null;
    }

    try {
        // Use actual remove liquidity quote to get accurate token amounts
        const lpDecimals = vault.decimals || 6;
        const lpAmountMicroUnits = Math.round(lpTokenAmount * Math.pow(10, lpDecimals));
        
        const quoteResult = await getRemoveLiquidityQuote(vault.contractId, lpAmountMicroUnits);
        
        if (!quoteResult.success || !quoteResult.quote) {
            return null;
        }

        const { dx, dy } = quoteResult.quote;
        
        // Convert token amounts from microunits to display units
        const tokenADecimals = vault.tokenA.decimals || 6;
        const tokenBDecimals = vault.tokenB.decimals || 6;
        
        const lpTokenAAmount = dx / Math.pow(10, tokenADecimals);
        const lpTokenBAmount = dy / Math.pow(10, tokenBDecimals);

        return {
            tokenA: {
                symbol: vault.tokenA.symbol,
                value: lpTokenAAmount * priceA,
                price: priceA,
                amount: lpTokenAAmount
            },
            tokenB: {
                symbol: vault.tokenB.symbol,
                value: lpTokenBAmount * priceB,
                price: priceB,
                amount: lpTokenBAmount
            }
        };

    } catch (error) {
        console.error(`[LP Calculator] Error calculating asset breakdown for ${vault.contractId}:`, error);
        return null;
    }
};

/**
 * Compare LP token market price with intrinsic value using remove liquidity quotes
 * @param vault - The vault/pool data
 * @param prices - Token prices keyed by contract ID (should include LP token price if tradable)
 * @param lpTokenAmount - Amount of LP tokens to analyze (default: 1)
 * @returns Complete price analysis
 */
export const analyzeLpTokenPricing = async (
    vault: Vault,
    prices: Record<string, number>,
    lpTokenAmount: number = 1
): Promise<LpTokenPriceAnalysis> => {
    // Get market price of LP token if it exists as a tradable token
    const marketPrice = prices[vault.contractId] || null;
    
    // Calculate intrinsic value using remove liquidity quote
    const intrinsicValue = await calculateLpIntrinsicValueFromVault(vault, prices, lpTokenAmount);
    
    // Calculate asset breakdown using remove liquidity quote
    const assetBreakdown = await calculateAssetBreakdown(vault, prices, lpTokenAmount);
    
    // Calculate differences if both prices are available
    let priceDifference: number | null = null;
    let absoluteDifference: number | null = null;
    let isArbitrageOpportunity = false;

    if (marketPrice && intrinsicValue) {
        priceDifference = ((marketPrice - intrinsicValue) / intrinsicValue) * 100;
        absoluteDifference = marketPrice - intrinsicValue;
        
        // Consider it an arbitrage opportunity if difference is > 5%
        isArbitrageOpportunity = Math.abs(priceDifference) > 5;
    }

    // For total supply, we could make another contract call, but for now keep it simple
    const totalSupply = null; // Would need separate contract call to get accurate total supply

    return {
        marketPrice,
        intrinsicValue,
        priceDifference,
        absoluteDifference,
        isArbitrageOpportunity,
        assetBreakdown,
        totalSupply
    };
};

/**
 * Format price analysis for display
 * @param analysis - LP token price analysis result
 * @returns Formatted strings for UI display
 */
export const formatLpPriceAnalysis = (analysis: LpTokenPriceAnalysis) => {
    const formatCurrency = (value: number | null) => 
        value ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : 'N/A';
    
    const formatPercentage = (value: number | null) =>
        value ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : 'N/A';

    return {
        marketPrice: formatCurrency(analysis.marketPrice),
        intrinsicValue: formatCurrency(analysis.intrinsicValue),
        priceDifference: formatPercentage(analysis.priceDifference),
        absoluteDifference: formatCurrency(analysis.absoluteDifference),
        isArbitrageOpportunity: analysis.isArbitrageOpportunity
    };
};

/**
 * Calculate LP intrinsic value by contract ID using remove liquidity quotes
 * NOTE: This function is now deprecated - use calculateAllLpIntrinsicValues for dependency-aware processing
 * @param contractId - LP token contract ID
 * @param prices - Token prices keyed by contract ID
 * @param lpTokenAmount - Amount of LP tokens to calculate value for (default: 1)
 * @returns Pricing result with USD price, sBTC ratio and confidence
 */
export const calculateLpIntrinsicValue = async (
    contractId: string,
    prices: Record<string, number>,
    lpTokenAmount: number = 1
): Promise<{ usdPrice: number; sbtcRatio: number; confidence: number } | null> => {
    try {
        // Find the vault by contract ID
        const allVaults = await getAllVaultData();
        const vault = allVaults.find(v => v.contractId === contractId);
        
        if (!vault) {
            console.warn(`[LP Calculator] Vault not found for contract: ${contractId}`);
            return null;
        }

        // Use the new quote-based function
        const intrinsicUsdPrice = await calculateLpIntrinsicValueFromVault(vault, prices, lpTokenAmount);
        
        if (intrinsicUsdPrice === null) {
            console.warn(`[LP Calculator] Failed to calculate intrinsic value for: ${contractId}`);
            return null;
        }

        // Convert to sBTC ratio (assuming sBTC price is available)
        const sbtcPrice = prices['SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token'] || 100000; // fallback price
        const sbtcRatio = intrinsicUsdPrice / sbtcPrice;
        
        // Set confidence higher since we're now using actual contract logic
        const confidence = 0.9; // Higher confidence for quote-based calculation
        
        return {
            usdPrice: intrinsicUsdPrice,
            sbtcRatio,
            confidence
        };
        
    } catch (error) {
        console.error(`[LP Calculator] Error calculating intrinsic value for ${contractId}:`, error);
        return null;
    }
};

/**
 * Calculate all LP token intrinsic values with dependency resolution
 * @param basePrices - Base token prices (non-LP tokens)
 * @returns Map of contract ID to intrinsic pricing results
 */
export const calculateAllLpIntrinsicValues = async (
    basePrices: Record<string, number>
): Promise<Map<string, { usdPrice: number; sbtcRatio: number; confidence: number; level: number }>> => {
    // Import here to avoid circular dependency
    const { calculateAllLpIntrinsicValues: processAllLp } = await import('./lp-processing-queue');
    
    const results = await processAllLp(basePrices);
    
    // Convert from LpIntrinsicResult to the expected format
    const converted = new Map<string, { usdPrice: number; sbtcRatio: number; confidence: number; level: number }>();
    
    results.forEach((result, contractId) => {
        converted.set(contractId, {
            usdPrice: result.usdPrice,
            sbtcRatio: result.sbtcRatio,
            confidence: result.confidence,
            level: result.level
        });
    });
    
    return converted;
};