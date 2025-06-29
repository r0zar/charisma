// Enhanced energy analytics with proper rate calculations

// ---- Updated Interfaces for Accurate Energy Analytics ----

export interface EnergyLog {
    tx_id: string;
    block_height: number;
    energy: number;
    integral: number;
    message: string;
    op: string;
    sender: string;
    block_time: number | null; // Unix timestamp (seconds)
    block_time_iso: string | null; // ISO string format of block_time
    tx_status: string | null;
}

export interface HarvestHistoryEntry {
    timestamp: number;
    energy: number;
    integral: number;
    blockHeight: number;
    txId: string;
    timeSinceLastHarvest?: number; // seconds since previous harvest
    effectiveRate?: number; // energy/second for this harvest period
}

// Separate current rate from historical totals
export interface UserCurrentEnergyRate {
    // Current generation rate (based on recent harvests)
    energyPerSecond: number; // Current rate in energy/second
    energyPerMinute: number; // Current rate in energy/minute  
    energyPerHour: number; // Current rate in energy/hour
    
    // Rate calculation metadata
    calculatedFromPeriods: number; // How many harvest periods used for calculation
    calculationMethod: 'recent_average' | 'latest_period' | 'trend_analysis';
    lastCalculated: number; // Timestamp when rate was calculated
    confidenceLevel: 'high' | 'medium' | 'low'; // Based on data quality
}

export interface UserHistoricalStats {
    // Historical totals (all-time)
    totalEnergyHarvested: number;
    totalIntegralCalculated: number;
    harvestCount: number;
    averageEnergyPerHarvest: number;
    
    // Time-based historical stats
    firstHarvestTimestamp: number;
    lastHarvestTimestamp: number;
    totalActiveTimespan: number; // Seconds between first and last harvest
    averageTimeBetweenHarvests: number; // Seconds
    
    // Complete harvest record
    harvestHistory: HarvestHistoryEntry[];
}

export interface UserEnergyStats {
    address: string;
    
    // Current generation rate (for real-time tracking)
    currentRate: UserCurrentEnergyRate;
    
    // Historical statistics (for analytics)
    historical: UserHistoricalStats;
    
    // Last update metadata
    lastUpdated: number;
    dataQuality: 'excellent' | 'good' | 'limited' | 'insufficient';
}

export interface EnergyAnalyticsData {
    logs: EnergyLog[];
    stats: EnergyStats; // Contract-wide stats
    rates: EnergyRateDetails; // Contract-wide rates
    userStats: Record<string, UserEnergyStats | null>; // Updated user stats
}

// Keep existing interfaces for backward compatibility
export interface EnergyStats {
    totalEnergyHarvested: number;
    totalIntegralCalculated: number;
    uniqueUsers: number;
    averageEnergyPerHarvest: number;
    averageIntegralPerHarvest: number;
    lastUpdated: number;
}

export interface UserEnergyRate {
    address: string;
    energyPerMinute: number;
}

export interface EnergyRateDetails {
    overallEnergyPerMinute: number;
    overallIntegralPerMinute: number;
    topUserRates: UserEnergyRate[];
    lastCalculated: number;
}

// ---- Enhanced Rate Calculation Functions ----

/**
 * Calculates current energy generation rate from recent harvest data
 * Uses multiple methods to determine the most accurate current rate
 */
export function calculateCurrentEnergyRate(
    userLogs: EnergyLog[],
    userAddress: string
): UserCurrentEnergyRate {
    if (!userLogs || userLogs.length < 2) {
        return {
            energyPerSecond: 0,
            energyPerMinute: 0,
            energyPerHour: 0,
            calculatedFromPeriods: 0,
            calculationMethod: 'insufficient_data' as any,
            lastCalculated: Date.now(),
            confidenceLevel: 'low'
        };
    }

    // Sort logs by time (most recent first)
    const sortedLogs = [...userLogs].sort((a, b) => (b.block_time || 0) - (a.block_time || 0));
    
    // Calculate rates for each harvest period
    const periodRates: number[] = [];
    
    for (let i = 0; i < sortedLogs.length - 1; i++) {
        const currentHarvest = sortedLogs[i];
        const previousHarvest = sortedLogs[i + 1];
        
        if (currentHarvest.block_time && previousHarvest.block_time) {
            const timeDiff = currentHarvest.block_time - previousHarvest.block_time; // seconds
            if (timeDiff > 0) {
                const energyRate = currentHarvest.energy / timeDiff; // energy per second (in micro-units)
                periodRates.push(energyRate);
            }
        }
    }

    if (periodRates.length === 0) {
        return {
            energyPerSecond: 0,
            energyPerMinute: 0,
            energyPerHour: 0,
            calculatedFromPeriods: 0,
            calculationMethod: 'insufficient_data' as any,
            lastCalculated: Date.now(),
            confidenceLevel: 'low'
        };
    }

    // Choose calculation method based on data availability
    let energyPerSecond: number;
    let calculationMethod: 'recent_average' | 'latest_period' | 'trend_analysis';
    let confidenceLevel: 'high' | 'medium' | 'low';

    if (periodRates.length >= 5) {
        // Use recent average (last 5 periods) for high confidence
        const recentRates = periodRates.slice(0, 5);
        energyPerSecond = recentRates.reduce((sum, rate) => sum + rate, 0) / recentRates.length;
        calculationMethod = 'recent_average';
        confidenceLevel = 'high';
    } else if (periodRates.length >= 2) {
        // Use recent average for medium confidence
        energyPerSecond = periodRates.reduce((sum, rate) => sum + rate, 0) / periodRates.length;
        calculationMethod = 'recent_average';
        confidenceLevel = 'medium';
    } else {
        // Use single period for low confidence
        energyPerSecond = periodRates[0];
        calculationMethod = 'latest_period';
        confidenceLevel = 'low';
    }

    return {
        energyPerSecond,
        energyPerMinute: energyPerSecond * 60,
        energyPerHour: energyPerSecond * 3600,
        calculatedFromPeriods: periodRates.length,
        calculationMethod,
        lastCalculated: Date.now(),
        confidenceLevel
    };
}

/**
 * Extracts comprehensive user energy statistics with proper rate calculation
 */
export function getUserEnergyStatsV2(logs: EnergyLog[], userAddress: string): UserEnergyStats | null {
    if (!logs || logs.length === 0 || !userAddress) {
        return null;
    }

    // Filter logs for the specific user
    const userLogs = logs.filter(log => log.sender === userAddress);

    if (userLogs.length === 0) {
        return null;
    }

    // Sort logs by time (oldest first for historical processing)
    const sortedLogs = [...userLogs].sort((a, b) => (a.block_time || 0) - (b.block_time || 0));

    // Calculate historical stats
    const totalEnergyHarvested = userLogs.reduce((sum, log) => sum + Number(log.energy), 0);
    const totalIntegralCalculated = userLogs.reduce((sum, log) => sum + Number(log.integral), 0);
    const harvestCount = userLogs.length;
    const averageEnergyPerHarvest = harvestCount > 0 ? totalEnergyHarvested / harvestCount : 0;

    // Time-based stats
    const firstHarvestTimestamp = sortedLogs[0]?.block_time ? sortedLogs[0].block_time * 1000 : Date.now();
    const lastHarvestTimestamp = sortedLogs[sortedLogs.length - 1]?.block_time 
        ? sortedLogs[sortedLogs.length - 1].block_time! * 1000 
        : Date.now();
    const totalActiveTimespan = Math.max(1, (lastHarvestTimestamp - firstHarvestTimestamp) / 1000);
    
    // Calculate average time between harvests
    let averageTimeBetweenHarvests = 0;
    if (sortedLogs.length > 1) {
        const timeDiffs: number[] = [];
        for (let i = 1; i < sortedLogs.length; i++) {
            if (sortedLogs[i].block_time && sortedLogs[i-1].block_time) {
                timeDiffs.push(sortedLogs[i].block_time! - sortedLogs[i-1].block_time!);
            }
        }
        if (timeDiffs.length > 0) {
            averageTimeBetweenHarvests = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
        }
    }

    // Build enhanced harvest history
    const harvestHistory: HarvestHistoryEntry[] = sortedLogs.map((log, index) => {
        const entry: HarvestHistoryEntry = {
            timestamp: log.block_time ? log.block_time * 1000 : Date.now(),
            energy: Number(log.energy),
            integral: Number(log.integral),
            blockHeight: log.block_height,
            txId: log.tx_id
        };

        // Add time and rate information for periods after the first
        if (index > 0 && log.block_time && sortedLogs[index - 1].block_time) {
            const timeSinceLastHarvest = log.block_time - sortedLogs[index - 1].block_time!;
            const effectiveRate = timeSinceLastHarvest > 0 ? Number(log.energy) / timeSinceLastHarvest : 0; // energy per second (in micro-units)
            
            entry.timeSinceLastHarvest = timeSinceLastHarvest;
            entry.effectiveRate = effectiveRate;
        }

        return entry;
    });

    // Calculate current generation rate
    const currentRate = calculateCurrentEnergyRate(userLogs, userAddress);

    // Determine data quality
    let dataQuality: 'excellent' | 'good' | 'limited' | 'insufficient';
    if (harvestCount >= 10 && currentRate.confidenceLevel === 'high') {
        dataQuality = 'excellent';
    } else if (harvestCount >= 5 && currentRate.confidenceLevel !== 'low') {
        dataQuality = 'good';
    } else if (harvestCount >= 2) {
        dataQuality = 'limited';
    } else {
        dataQuality = 'insufficient';
    }

    return {
        address: userAddress,
        currentRate,
        historical: {
            totalEnergyHarvested,
            totalIntegralCalculated,
            harvestCount,
            averageEnergyPerHarvest,
            firstHarvestTimestamp,
            lastHarvestTimestamp,
            totalActiveTimespan,
            averageTimeBetweenHarvests,
            harvestHistory
        },
        lastUpdated: Date.now(),
        dataQuality
    };
}

// Export legacy function for backward compatibility
export { fetcHoldToEarnLogs } from './analytics';
export { calculateEnergyRates } from './analytics';
export { processAllEnergyData } from './analytics';