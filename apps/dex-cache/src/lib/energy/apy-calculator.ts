import { type EnergyTokenPrices, getEnergyValueUSD, getTokenPriceUSD, ENERGY_TOKENS } from './price-service';
import { type RealTimeEnergyData } from './real-time';
import { type KraxelPriceData } from '@repo/tokens';

export interface APYCalculationResult {
    apy: number; // Annual Percentage Yield
    dailyProfit: number; // Daily profit in USD
    dailyEnergyValue: number; // Daily energy value in USD
    dailyEnergyGenerated: number; // Daily energy in atomic units
    annualEnergyValue: number; // Annual energy value in USD
    tokenInvestmentValue: number; // Current token holdings value in USD
    confidence: number; // Calculation confidence (0-1)
    breakdown: {
        energyRatePerSecond: number;
        energyRatePerDay: number;
        energyPriceUSD: number;
        tokenHoldingsUSD: number;
        nftBonusMultiplier?: number;
    };
    warnings?: string[];
}

export interface TokenHolding {
    symbol: string; // 'SXC', 'POV', 'DEX', etc.
    amount: number; // Amount in human-readable units
    contractId?: string;
}

export interface APYCalculationParams {
    energyData: RealTimeEnergyData;
    prices: EnergyTokenPrices | KraxelPriceData[] | Record<string, number>; // Support multiple formats
    tokenHoldings?: TokenHolding[]; // User's token holdings that generate energy
    nftBonuses?: {
        generationMultiplier?: number; // Welsh NFT bonuses
        capacityBonus?: number; // Memobot capacity bonuses
        feeReduction?: number; // Raven fee reductions
    };
}

/**
 * Convert price map (Record<string, number>) to EnergyTokenPrices format
 */
export function convertPriceMapToEnergyTokenPrices(priceMap: Record<string, number>): EnergyTokenPrices {
    const now = Date.now();

    const result: EnergyTokenPrices = {
        lastUpdated: now,
        isStale: false,
        confidence: 0.8 // Default confidence
    };

    // Look for energy token prices by contract ID
    const hootPrice = priceMap[ENERGY_TOKENS.HOOT];
    const energyPrice = priceMap[ENERGY_TOKENS.ENERGY];
    const charismaPrice = priceMap[ENERGY_TOKENS.CHARISMA];
    const dexterityPrice = priceMap[ENERGY_TOKENS.DEXTERITY];

    if (hootPrice !== undefined) {
        result.hoot = {
            tokenId: ENERGY_TOKENS.HOOT,
            symbol: 'HOOT',
            usdPrice: hootPrice,
            sbtcRatio: hootPrice / 65000, // Assume BTC ~$65k
            confidence: 0.8,
            lastUpdated: now
        };
    }

    if (energyPrice !== undefined) {
        result.energy = {
            tokenId: ENERGY_TOKENS.ENERGY,
            symbol: 'ENERGY',
            usdPrice: energyPrice,
            sbtcRatio: energyPrice / 65000,
            confidence: 0.8,
            lastUpdated: now
        };
    }

    if (charismaPrice !== undefined) {
        result.charisma = {
            tokenId: ENERGY_TOKENS.CHARISMA,
            symbol: 'CHARISMA',
            usdPrice: charismaPrice,
            sbtcRatio: charismaPrice / 65000,
            confidence: 0.8,
            lastUpdated: now
        };
    }

    if (dexterityPrice !== undefined) {
        result.dexterity = {
            tokenId: ENERGY_TOKENS.DEXTERITY,
            symbol: 'DEXTERITY',
            usdPrice: dexterityPrice,
            sbtcRatio: dexterityPrice / 65000,
            confidence: 0.8,
            lastUpdated: now
        };
    }

    // Calculate average confidence
    const availablePrices = [result.hoot, result.energy, result.charisma, result.dexterity].filter(Boolean);
    if (availablePrices.length > 0) {
        result.confidence = availablePrices.reduce((sum, price) => sum + (price?.confidence || 0), 0) / availablePrices.length;
    }

    return result;
}

/**
 * Convert KraxelPriceData[] to EnergyTokenPrices format
 */
export function convertKraxelPricesToEnergyTokenPrices(kraxelPrices: KraxelPriceData[]): EnergyTokenPrices {
    const now = Date.now();

    // Helper to find price by contract ID
    const findPrice = (contractId: string) => {
        return kraxelPrices.find(p => (p as any).contractId === contractId);
    };

    // Get prices for energy tokens using constants
    const hootPrice = findPrice(ENERGY_TOKENS.HOOT);
    const energyPrice = findPrice(ENERGY_TOKENS.ENERGY);
    const charismaPrice = findPrice(ENERGY_TOKENS.CHARISMA);
    const dexterityPrice = findPrice(ENERGY_TOKENS.DEXTERITY);

    const result: EnergyTokenPrices = {
        lastUpdated: now,
        isStale: false,
        confidence: 0.8 // Default confidence
    };


    if (hootPrice) {
        result.hoot = {
            tokenId: String(hootPrice.contractId),
            symbol: 'HOOT',
            usdPrice: hootPrice.usdPrice,
            sbtcRatio: hootPrice.usdPrice / 65000, // Assume BTC ~$65k
            confidence: hootPrice.confidence || 0.8,
            lastUpdated: now
        };
    }

    if (energyPrice) {
        result.energy = {
            tokenId: String(energyPrice.contractId),
            symbol: 'ENERGY',
            usdPrice: energyPrice.usdPrice,
            sbtcRatio: energyPrice.usdPrice / 65000,
            confidence: energyPrice.confidence || 0.8,
            lastUpdated: now
        };
    }

    if (charismaPrice) {
        result.charisma = {
            tokenId: String(charismaPrice.contractId),
            symbol: 'CHARISMA',
            usdPrice: charismaPrice.usdPrice,
            sbtcRatio: charismaPrice.usdPrice / 65000,
            confidence: charismaPrice.confidence || 0.8,
            lastUpdated: now
        };
    }

    if (dexterityPrice) {
        result.dexterity = {
            tokenId: String(dexterityPrice.contractId),
            symbol: 'DEXTERITY',
            usdPrice: dexterityPrice.usdPrice,
            sbtcRatio: dexterityPrice.usdPrice / 65000,
            confidence: dexterityPrice.confidence || 0.8,
            lastUpdated: now
        };
    }

    // Calculate average confidence
    const availablePrices = [result.hoot, result.energy, result.charisma, result.dexterity].filter(Boolean);
    if (availablePrices.length > 0) {
        result.confidence = availablePrices.reduce((sum, price) => sum + (price?.confidence || 0), 0) / availablePrices.length;
    }

    return result;
}

/**
 * Calculate APY and daily profit for energy generation
 */
export function calculateEnergyAPY(params: APYCalculationParams): APYCalculationResult {
    const { energyData, prices: rawPrices, tokenHoldings = [], nftBonuses = {} } = params;

    // Determine price format
    const pricesType = Array.isArray(rawPrices)
        ? 'KraxelPriceData[]'
        : (rawPrices && typeof rawPrices === 'object' && !rawPrices.hasOwnProperty('lastUpdated'))
            ? 'PriceMap'
            : 'EnergyTokenPrices';

    const warnings: string[] = [];

    // Convert prices to EnergyTokenPrices format if needed
    let prices: EnergyTokenPrices;

    if (Array.isArray(rawPrices)) {
        prices = convertKraxelPricesToEnergyTokenPrices(rawPrices);
    } else if (pricesType === 'PriceMap') {
        prices = convertPriceMapToEnergyTokenPrices(rawPrices as Record<string, number>);
    } else {
        prices = rawPrices as EnergyTokenPrices;
    }

    // Get energy value in USD (using HOOT price as baseline)
    const energyPriceUSD = getEnergyValueUSD(prices);


    if (energyPriceUSD === 0) {
        warnings.push('Energy price unavailable, calculations may be inaccurate');
    }

    // Calculate energy generation rates
    const energyRatePerSecond = energyData.energyRatePerSecond || 0;
    const energyRatePerDay = energyRatePerSecond * 86400; // 24 * 60 * 60
    const energyRatePerYear = energyRatePerDay * 365;


    // Apply NFT bonuses to generation rate
    const generationMultiplier = 1 + (nftBonuses.generationMultiplier || 0);
    const adjustedDailyRate = energyRatePerDay * generationMultiplier;
    const adjustedAnnualRate = energyRatePerYear * generationMultiplier;


    // Calculate energy values in USD
    // Note: energyRatePerSecond is in micro-units, so convert to human-readable units
    const dailyEnergyTokens = adjustedDailyRate / Math.pow(10, 6); // Convert from micro-units to energy tokens
    const annualEnergyTokens = adjustedAnnualRate / Math.pow(10, 6);
    const dailyEnergyValue = dailyEnergyTokens * energyPriceUSD;
    const annualEnergyValue = annualEnergyTokens * energyPriceUSD;


    // Calculate token investment value
    let tokenInvestmentValue = 0;
    const holdingDetails: any[] = [];

    for (const holding of tokenHoldings) {
        const tokenPrice = getTokenPriceUSD(prices, holding.symbol);
        const holdingValue = holding.amount * tokenPrice;

        holdingDetails.push({
            symbol: holding.symbol,
            amount: holding.amount,
            priceUSD: tokenPrice,
            valueUSD: holdingValue
        });

        if (tokenPrice > 0) {
            tokenInvestmentValue += holdingValue;
        } else {
            warnings.push(`Price unavailable for ${holding.symbol}`);
        }
    }


    // Calculate APY
    let apy = 0;
    if (tokenInvestmentValue > 0) {
        apy = (annualEnergyValue / tokenInvestmentValue) * 100;
    } else {
        // No token holdings found - show energy value but note that APY calculation requires holdings

        if (adjustedAnnualRate > 0 && energyPriceUSD > 0) {
            warnings.push('Hold energy-generating tokens to see actual APY based on your investment');
        } else {
            warnings.push('No energy generation detected');
        }
        apy = 0; // Cannot calculate APY without knowing investment amount
    }

    // Daily profit is simply the daily energy value (no costs factored in for now)
    const dailyProfit = dailyEnergyValue;


    // Account for capacity limitations
    const maxCapacity = energyData.maxCapacity || 100000000; // 100 energy default
    const capacityPercentage = energyData.capacityPercentage || 0;

    if (capacityPercentage >= 95) {
        warnings.push('Energy tank nearly full - harvest to avoid waste');
        // Note: Don't adjust APY for capacity - APY represents theoretical annual return
        // The daily profit already reflects what's currently being earned
    }

    // Calculate confidence based on price confidence and data quality
    let confidence = prices.confidence || 0;

    if (energyData.dataQuality === 'excellent') confidence *= 1.0;
    else if (energyData.dataQuality === 'good') confidence *= 0.9;
    else if (energyData.dataQuality === 'limited') confidence *= 0.7;
    else confidence *= 0.5; // insufficient

    if (prices.isStale) {
        confidence *= 0.8;
        warnings.push('Price data is stale');
    }

    const result = {
        apy,
        dailyProfit,
        dailyEnergyValue,
        dailyEnergyGenerated: adjustedDailyRate,
        annualEnergyValue,
        tokenInvestmentValue,
        confidence,
        breakdown: {
            energyRatePerSecond,
            energyRatePerDay: adjustedDailyRate,
            energyPriceUSD,
            tokenHoldingsUSD: tokenInvestmentValue,
            nftBonusMultiplier: generationMultiplier > 1 ? generationMultiplier : undefined
        },
        warnings: warnings.length > 0 ? warnings : undefined
    };


    return result;
}

/**
 * Calculate potential APY for a given token investment
 */
export function calculatePotentialAPY(
    tokenAmount: number,
    tokenSymbol: string,
    energyRatePerToken: number, // Energy per token per second
    prices: EnergyTokenPrices
): { apy: number; dailyProfit: number; confidence: number } {
    const tokenPrice = getTokenPriceUSD(prices, tokenSymbol);
    const energyPrice = getEnergyValueUSD(prices);

    if (tokenPrice === 0 || energyPrice === 0) {
        return { apy: 0, dailyProfit: 0, confidence: 0 };
    }

    const investment = tokenAmount * tokenPrice;
    const dailyEnergyGenerated = energyRatePerToken * tokenAmount * 86400; // per day
    const dailyEnergyValue = (dailyEnergyGenerated / Math.pow(10, 6)) * energyPrice;
    const annualEnergyValue = dailyEnergyValue * 365;

    const apy = (annualEnergyValue / investment) * 100;

    return {
        apy,
        dailyProfit: dailyEnergyValue,
        confidence: prices.confidence || 0
    };
}

/**
 * Format APY for display
 */
export function formatAPY(apy: number): string {
    if (!isFinite(apy) || apy === 0) return '0.0%';
    if (Math.abs(apy) < 0.1) return `${apy.toFixed(2)}%`;
    if (Math.abs(apy) < 10) return `${apy.toFixed(1)}%`;
    return `${Math.round(apy)}%`;
}

/**
 * Format daily profit for display
 */
export function formatDailyProfit(profit: number): string {
    if (profit === 0) return '$0.00';
    if (profit < 0.01) return `$${profit.toFixed(4)}`;
    if (profit < 1) return `$${profit.toFixed(3)}`;
    return `$${profit.toFixed(2)}`;
}

/**
 * Get APY color class based on value
 */
export function getAPYColorClass(apy: number): string {
    if (apy <= 0) return 'text-gray-500';
    if (apy < 5) return 'text-yellow-500';
    if (apy < 15) return 'text-green-500';
    if (apy < 50) return 'text-green-400';
    return 'text-green-300'; // Very high APY
}

/**
 * Get confidence indicator
 */
export function getConfidenceIndicator(confidence: number): {
    label: string;
    color: string;
    icon: string;
} {
    if (confidence >= 0.9) {
        return { label: 'High', color: 'text-green-500', icon: '●' };
    } else if (confidence >= 0.7) {
        return { label: 'Medium', color: 'text-yellow-500', icon: '●' };
    } else if (confidence >= 0.5) {
        return { label: 'Low', color: 'text-orange-500', icon: '●' };
    } else {
        return { label: 'Very Low', color: 'text-red-500', icon: '●' };
    }
}