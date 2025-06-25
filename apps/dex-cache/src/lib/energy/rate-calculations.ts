import type { TokenCacheData } from '@repo/tokens';

/**
 * Represents the components that make up an energy rate calculation
 */
export interface EnergyRateBreakdown {
    userBalance: number;           // User's token balance (raw units)
    userBalanceFormatted: number;  // User's token balance (display units)
    baseRate: number;              // Base energy rate per token per second (raw units)
    baseRateFormatted: number;     // Base energy rate per token per second (display units)
    rawEnergyRate: number;         // Balance × base rate (raw units)
    total_supply: number;           // Token's total supply (raw units)
    supplyDilutionFactor: number;  // How total supply affects rate (0-1)
    finalEnergyRate: number;       // Final energy per second (raw units)
    finalEnergyRateFormatted: number; // Final energy per second (display units)
    timeToFillCapacity: number;    // Seconds to fill 100 energy capacity
    efficiencyRatio: number;       // Energy per token per hour
}

/**
 * Parameters for energy rate calculations
 */
export interface EnergyCalculationParams {
    userBalance: number;           // User's current token balance
    baseEnergyRate?: number;       // Base energy generation rate (default: derived from data)
    total_supply?: number;          // Token total supply (default: from metadata)
    capacityLimit?: number;        // Energy capacity limit (default: 100)
    tokenDecimals?: number;        // Token decimal places (default: 6)
    energyDecimals?: number;       // Energy token decimal places (default: 6)
}

/**
 * Smart contract constants and formulas based on the hold-to-earn implementation
 */
export const ENERGY_CONSTANTS = {
    DEFAULT_INCENTIVE_SCORE: 100000,  // 10% annual rate from smart contract
    DEFAULT_CAPACITY: 100,            // Default energy capacity
    BLOCKS_PER_YEAR: 52560,          // Approximate blocks per year (10 min blocks)
    SECONDS_PER_BLOCK: 600,          // 10 minute blocks in seconds
    MINUTES_PER_BLOCK: 10,           // 10 minute blocks
} as const;

/**
 * Calculate the base energy rate per token based on smart contract logic
 */
export function calculateBaseEnergyRate(
    incentiveScore: number = ENERGY_CONSTANTS.DEFAULT_INCENTIVE_SCORE,
    total_supply: number,
    tokenDecimals: number = 6
): number { // Base rate calculation from smart contract:
    // energy = (balance_integral × incentive_score) / total_supply
    // For 1 token held for 1 block: balance_integral = balance × 1 block
    // So: energy_per_block = (balance × incentive_score) / total_supply
    
    const oneToken = Math.pow(10, tokenDecimals); // 1 token in raw units
    const energyPerBlockForOneToken = (oneToken * incentiveScore) / total_supply;
    
    // Convert per block to per second
    const energyPerSecondForOneToken = energyPerBlockForOneToken / ENERGY_CONSTANTS.SECONDS_PER_BLOCK;
    
    return energyPerSecondForOneToken;
}

/**
 * Calculate comprehensive energy rate breakdown for a user
 */
export function calculateEnergyRateBreakdown(
    params: EnergyCalculationParams,
    tokenMetadata?: TokenCacheData,
    energyTokenMetadata?: TokenCacheData
): EnergyRateBreakdown { const {
        userBalance,
        baseEnergyRate,
        total_supply,
        capacityLimit = ENERGY_CONSTANTS.DEFAULT_CAPACITY,
        tokenDecimals = tokenMetadata?.decimals || 6,
        energyDecimals = energyTokenMetadata?.decimals || 6
    } = params;

    // Get total supply from metadata or use provided value
    const actualTotalSupply = total_supply || 
        (tokenMetadata?.total_supply ? parseFloat(tokenMetadata.total_supply) : 0);

    // Calculate base rate if not provided
    const actualBaseRate = baseEnergyRate || 
        calculateBaseEnergyRate(ENERGY_CONSTANTS.DEFAULT_INCENTIVE_SCORE, actualTotalSupply, tokenDecimals);

    // Raw calculations (in base units)
    const rawEnergyRate = userBalance * actualBaseRate;
    
    // Supply dilution factor (how much total supply affects individual rates)
    // In practice, this is already factored into baseRate, but we show it for educational purposes
    const supplyDilutionFactor = actualTotalSupply > 0 ? 
        Math.min(1, ENERGY_CONSTANTS.DEFAULT_INCENTIVE_SCORE / actualTotalSupply) : 1;

    const finalEnergyRate = rawEnergyRate; // Already includes supply factor in baseRate

    // Convert to display units
    const tokenDivisor = Math.pow(10, tokenDecimals);
    const energyDivisor = Math.pow(10, energyDecimals);
    
    const userBalanceFormatted = userBalance / tokenDivisor;
    const baseRateFormatted = actualBaseRate / (energyDivisor / tokenDivisor); // energy per token
    const finalEnergyRateFormatted = finalEnergyRate / energyDivisor;

    // Calculate time metrics
    const capacityInRawUnits = capacityLimit * energyDivisor;
    const timeToFillCapacity = finalEnergyRate > 0 ? capacityInRawUnits / finalEnergyRate : Infinity;
    
    // Efficiency metrics
    const efficiencyRatio = finalEnergyRateFormatted * 3600; // Energy per hour

    return {
        userBalance,
        userBalanceFormatted,
        baseRate: actualBaseRate,
        baseRateFormatted,
        rawEnergyRate,
        total_supply: actualTotalSupply,
        supplyDilutionFactor,
        finalEnergyRate,
        finalEnergyRateFormatted,
        timeToFillCapacity,
        efficiencyRatio
    };
}

/**
 * Simulate energy accumulation over time
 */
export function simulateEnergyAccumulation(
    energyRatePerSecond: number,
    durationSeconds: number,
    capacityLimit: number = ENERGY_CONSTANTS.DEFAULT_CAPACITY,
    energyDecimals: number = 6,
    startingEnergy: number = 0
): Array<{ time: number; energy: number; energyFormatted: number; isCapped: boolean }> {
    const energyDivisor = Math.pow(10, energyDecimals);
    const capacityInRawUnits = capacityLimit * energyDivisor;
    const startingEnergyRaw = startingEnergy * energyDivisor;
    
    const points: Array<{ time: number; energy: number; energyFormatted: number; isCapped: boolean }> = [];
    
    // Generate points every second for the first minute, then every minute
    const timePoints = [
        ...Array.from({ length: Math.min(60, durationSeconds) }, (_, i) => i),
        ...Array.from({ length: Math.floor(durationSeconds / 60) }, (_, i) => (i + 1) * 60)
            .filter(t => t <= durationSeconds)
    ];
    
    // Add final time point if not already included
    if (!timePoints.includes(durationSeconds)) {
        timePoints.push(durationSeconds);
    }
    
    for (const time of timePoints) {
        const rawEnergyAccumulated = startingEnergyRaw + (energyRatePerSecond * time);
        const cappedEnergy = Math.min(rawEnergyAccumulated, capacityInRawUnits);
        const isCapped = rawEnergyAccumulated >= capacityInRawUnits;
        
        points.push({
            time,
            energy: cappedEnergy,
            energyFormatted: cappedEnergy / energyDivisor,
            isCapped
        });
    }
    
    return points;
}

/**
 * Calculate optimal token balance for given energy goals
 */
export function calculateOptimalBalance(
    targetEnergyPerSecond: number,
    baseEnergyRate: number,
    tokenDecimals: number = 6
): number {
    if (baseEnergyRate <= 0) return 0;
    
    const requiredBalance = targetEnergyPerSecond / baseEnergyRate;
    const tokenDivisor = Math.pow(10, tokenDecimals);
    
    return Math.max(0, requiredBalance);
}

/**
 * Generate balance impact analysis data
 */
export function generateBalanceImpactData(
    maxBalance: number,
    steps: number,
    tokenMetadata?: TokenCacheData,
    energyTokenMetadata?: TokenCacheData
): Array<{
    balance: number;
    balanceFormatted: number;
    energyRate: number;
    energyRateFormatted: number;
    timeToFill: number;
    efficiency: number;
}> {
    const results: Array<{
        balance: number;
        balanceFormatted: number;
        energyRate: number;
        energyRateFormatted: number;
        timeToFill: number;
        efficiency: number;
    }> = [];
    
    const stepSize = maxBalance / steps;
    
    for (let i = 0; i <= steps; i++) {
        const balance = i * stepSize;
        
        if (balance === 0) {
            results.push({
                balance: 0,
                balanceFormatted: 0,
                energyRate: 0,
                energyRateFormatted: 0,
                timeToFill: Infinity,
                efficiency: 0
            });
            continue;
        }
        
        const breakdown = calculateEnergyRateBreakdown(
            { userBalance: balance },
            tokenMetadata,
            energyTokenMetadata
        );
        
        results.push({
            balance,
            balanceFormatted: breakdown.userBalanceFormatted,
            energyRate: breakdown.finalEnergyRate,
            energyRateFormatted: breakdown.finalEnergyRateFormatted,
            timeToFill: breakdown.timeToFillCapacity,
            efficiency: breakdown.efficiencyRatio
        });
    }
    
    return results;
}

/**
 * Validate energy rate calculations against known benchmarks
 */
export function validateCalculations(
    breakdown: EnergyRateBreakdown,
    knownData?: {
        expectedRate?: number;
        actualHarvestAmount?: number;
        timePeriod?: number;
    }
): {
    isValid: boolean;
    discrepancy: number;
    warnings: string[];
} {
    const warnings: string[] = [];
    let isValid = true;
    let discrepancy = 0;
    
    // Check for negative values
    if (breakdown.finalEnergyRate < 0) {
        warnings.push('Final energy rate is negative');
        isValid = false;
    }
    
    // Check for unrealistic rates
    if (breakdown.finalEnergyRateFormatted > 1000) {
        warnings.push('Energy rate seems unrealistically high (>1000/sec)');
    }
    
    // Check time to fill capacity
    if (breakdown.timeToFillCapacity < 60 && breakdown.finalEnergyRate > 0) {
        warnings.push('Time to fill capacity is very short (<1 minute)');
    }
    
    // Validate against known data if provided
    if (knownData?.expectedRate) {
        discrepancy = Math.abs(breakdown.finalEnergyRateFormatted - knownData.expectedRate) / knownData.expectedRate;
        if (discrepancy > 0.1) { // 10% tolerance
            warnings.push(`Rate differs from expected by ${(discrepancy * 100).toFixed(1)}%`);
            isValid = false;
        }
    }
    
    return {
        isValid,
        discrepancy,
        warnings
    };
}