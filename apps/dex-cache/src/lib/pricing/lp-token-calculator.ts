import { Vault } from '@/lib/pool-service';

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
 * Calculate the intrinsic value of an LP token based on underlying reserves
 * @param vault - The vault/pool data
 * @param prices - Token prices keyed by contract ID
 * @param lpTokenAmount - Amount of LP tokens to calculate value for (default: 1)
 * @returns Intrinsic value per LP token or null if calculation not possible
 */
export const calculateLpIntrinsicValue = (
    vault: Vault,
    prices: Record<string, number>,
    lpTokenAmount: number = 1
): number | null => {
    if (!vault.tokenA || !vault.tokenB || vault.reservesA === undefined || vault.reservesB === undefined) {
        return null;
    }

    const priceA = prices[vault.tokenA.contractId];
    const priceB = prices[vault.tokenB.contractId];

    if (!priceA || !priceB || vault.reservesA === 0 || vault.reservesB === 0) {
        return null;
    }

    // Calculate token amounts in proper decimal representation
    const tokenADecimals = vault.tokenA.decimals || 6;
    const tokenBDecimals = vault.tokenB.decimals || 6;
    
    const tokenAAmount = vault.reservesA / Math.pow(10, tokenADecimals);
    const tokenBAmount = vault.reservesB / Math.pow(10, tokenBDecimals);

    // Calculate total pool value in USD
    const poolValueA = tokenAAmount * priceA;
    const poolValueB = tokenBAmount * priceB;
    const totalPoolValue = poolValueA + poolValueB;

    // Better estimation of total LP supply based on geometric mean of reserves
    // This is a more realistic approach for AMM pools
    const lpDecimals = vault.decimals || 6;
    const estimatedTotalSupply = Math.sqrt(vault.reservesA * vault.reservesB) / Math.pow(10, lpDecimals);
    
    if (estimatedTotalSupply === 0 || totalPoolValue === 0) {
        return null;
    }

    // Calculate intrinsic value per LP token
    return (totalPoolValue / estimatedTotalSupply) * lpTokenAmount;
};

/**
 * Calculate detailed asset breakdown for LP token value
 * @param vault - The vault/pool data
 * @param prices - Token prices keyed by contract ID
 * @param lpTokenAmount - Amount of LP tokens to analyze (default: 1)
 * @returns Asset breakdown or null if calculation not possible
 */
export const calculateAssetBreakdown = (
    vault: Vault,
    prices: Record<string, number>,
    lpTokenAmount: number = 1
): LpTokenPriceAnalysis['assetBreakdown'] => {
    if (!vault.tokenA || !vault.tokenB || vault.reservesA === undefined || vault.reservesB === undefined) {
        return null;
    }

    const priceA = prices[vault.tokenA.contractId];
    const priceB = prices[vault.tokenB.contractId];

    if (!priceA || !priceB || vault.reservesA === 0 || vault.reservesB === 0) {
        return null;
    }

    // Calculate token amounts in proper decimal representation
    const tokenADecimals = vault.tokenA.decimals || 6;
    const tokenBDecimals = vault.tokenB.decimals || 6;
    
    const tokenAAmount = vault.reservesA / Math.pow(10, tokenADecimals);
    const tokenBAmount = vault.reservesB / Math.pow(10, tokenBDecimals);

    // Use the same LP supply calculation as intrinsic value
    const lpDecimals = vault.decimals || 6;
    const estimatedTotalSupply = Math.sqrt(vault.reservesA * vault.reservesB) / Math.pow(10, lpDecimals);
    
    if (estimatedTotalSupply === 0) {
        return null;
    }

    // Calculate share of pool represented by lpTokenAmount
    const poolShare = lpTokenAmount / estimatedTotalSupply;

    // Calculate token amounts and values for this LP amount
    const lpTokenAAmount = tokenAAmount * poolShare;
    const lpTokenBAmount = tokenBAmount * poolShare;

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
};

/**
 * Compare LP token market price with intrinsic value
 * @param vault - The vault/pool data
 * @param prices - Token prices keyed by contract ID (should include LP token price if tradable)
 * @param lpTokenAmount - Amount of LP tokens to analyze (default: 1)
 * @returns Complete price analysis
 */
export const analyzeLpTokenPricing = (
    vault: Vault,
    prices: Record<string, number>,
    lpTokenAmount: number = 1
): LpTokenPriceAnalysis => {
    // Get market price of LP token if it exists as a tradable token
    const marketPrice = prices[vault.contractId] || null;
    
    // Calculate intrinsic value
    const intrinsicValue = calculateLpIntrinsicValue(vault, prices, lpTokenAmount);
    
    // Calculate asset breakdown
    const assetBreakdown = calculateAssetBreakdown(vault, prices, lpTokenAmount);
    
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

    // Estimate total supply (in a real implementation, this would be queried from contract)
    const totalSupply = vault.reservesA && vault.reservesB ? vault.reservesA + vault.reservesB : null;

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