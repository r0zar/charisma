import type { EnergyLog, EnergyAnalyticsData } from './analytics';
import type { TokenCacheData } from '@repo/tokens';

export interface TokenEnergyRate {
    contractId: string;
    tokenSymbol: string;
    tokenName: string;
    energyPerBlock: number;
    energyPerHour: number;
    avgHoldersPerBlock: number;
    totalHolders: number;
    sampledBlocks: number;
    lastCalculated: number;
}

export interface EnergyRateTimePoint {
    blockHeight: number;
    timestamp: number;
    date: string; // YYYY-MM-DD format for grouping
    contractId: string;
    energyPerBlock: number;
    energyPerUser: number;
    activeUsers: number;
    totalEnergyInBlock: number;
}

export interface TokenRateHistory {
    contractId: string;
    tokenSymbol: string;
    tokenName: string;
    rateHistory: EnergyRateTimePoint[];
    averageRate: number;
    trendDirection: 'up' | 'down' | 'stable';
    volatility: number; // Coefficient of variation
}

/**
 * Calculate energy generation rate per block for a specific contract
 */
export function calculateEnergyPerBlock(
    logs: EnergyLog[],
    contractId: string,
    timeWindowHours = 24
): TokenEnergyRate {
    const now = Date.now() / 1000; // Convert to seconds
    const timeWindowSeconds = timeWindowHours * 3600;
    const cutoffTime = now - timeWindowSeconds;

    // Filter logs for the time window
    const recentLogs = logs.filter(log => 
        log.block_time && log.block_time >= cutoffTime
    );

    if (recentLogs.length === 0) {
        return {
            contractId,
            tokenSymbol: contractId.split('.')[1] || 'UNKNOWN',
            tokenName: contractId.split('.')[1] || 'Unknown Token',
            energyPerBlock: 0,
            energyPerHour: 0,
            avgHoldersPerBlock: 0,
            totalHolders: 0,
            sampledBlocks: 0,
            lastCalculated: now
        };
    }

    // Group logs by block height
    const blockGroups = new Map<number, EnergyLog[]>();
    const uniqueUsers = new Set<string>();

    recentLogs.forEach(log => {
        if (!blockGroups.has(log.block_height)) {
            blockGroups.set(log.block_height, []);
        }
        blockGroups.get(log.block_height)!.push(log);
        uniqueUsers.add(log.sender);
    });

    // Calculate energy per block
    const blockHeights = Array.from(blockGroups.keys()).sort((a, b) => a - b);
    const totalBlocks = blockHeights.length;
    
    if (totalBlocks === 0) {
        return {
            contractId,
            tokenSymbol: contractId.split('.')[1] || 'UNKNOWN',
            tokenName: contractId.split('.')[1] || 'Unknown Token',
            energyPerBlock: 0,
            energyPerHour: 0,
            avgHoldersPerBlock: 0,
            totalHolders: 0,
            sampledBlocks: 0,
            lastCalculated: now
        };
    }

    let totalEnergyAllBlocks = 0;
    let totalUsersAllBlocks = 0;

    blockGroups.forEach((blockLogs) => {
        const blockEnergy = blockLogs.reduce((sum, log) => sum + log.energy, 0);
        const blockUsers = new Set(blockLogs.map(log => log.sender)).size;
        
        totalEnergyAllBlocks += blockEnergy;
        totalUsersAllBlocks += blockUsers;
    });

    const avgEnergyPerBlock = totalEnergyAllBlocks / totalBlocks;
    const avgUsersPerBlock = totalUsersAllBlocks / totalBlocks;

    // Estimate energy per hour (assuming ~10 minute block times on average)
    const avgBlockTimeMinutes = 10;
    const blocksPerHour = 60 / avgBlockTimeMinutes;
    const energyPerHour = avgEnergyPerBlock * blocksPerHour;

    return {
        contractId,
        tokenSymbol: contractId.split('.')[1] || 'UNKNOWN',
        tokenName: contractId.split('.')[1] || 'Unknown Token',
        energyPerBlock: avgEnergyPerBlock,
        energyPerHour,
        avgHoldersPerBlock: avgUsersPerBlock,
        totalHolders: uniqueUsers.size,
        sampledBlocks: totalBlocks,
        lastCalculated: now
    };
}

/**
 * Generate time series data for energy rates over time
 */
export function generateEnergyRateTimeSeries(
    logs: EnergyLog[],
    contractId: string,
    daysBack = 30
): EnergyRateTimePoint[] {
    const now = Date.now() / 1000;
    const timeWindowSeconds = daysBack * 24 * 3600;
    const cutoffTime = now - timeWindowSeconds;

    // Filter and sort logs
    const recentLogs = logs
        .filter(log => log.block_time && log.block_time >= cutoffTime)
        .sort((a, b) => a.block_height - b.block_height);

    if (recentLogs.length === 0) return [];

    // Group by day for smoother chart data
    const dayGroups = new Map<string, EnergyLog[]>();
    
    recentLogs.forEach(log => {
        if (!log.block_time) return;
        
        const date = new Date(log.block_time * 1000);
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        if (!dayGroups.has(dateKey)) {
            dayGroups.set(dateKey, []);
        }
        dayGroups.get(dateKey)!.push(log);
    });

    const timePoints: EnergyRateTimePoint[] = [];

    dayGroups.forEach((dayLogs, dateKey) => {
        // Group day's logs by block
        const blockGroups = new Map<number, EnergyLog[]>();
        dayLogs.forEach(log => {
            if (!blockGroups.has(log.block_height)) {
                blockGroups.set(log.block_height, []);
            }
            blockGroups.get(log.block_height)!.push(log);
        });

        if (blockGroups.size === 0) return;

        // Calculate average energy per block for this day
        let totalEnergyForDay = 0;
        let totalUsersForDay = new Set<string>();
        let totalBlocksForDay = blockGroups.size;

        blockGroups.forEach((blockLogs, blockHeight) => {
            const blockEnergy = blockLogs.reduce((sum, log) => sum + log.energy, 0);
            totalEnergyForDay += blockEnergy;
            blockLogs.forEach(log => totalUsersForDay.add(log.sender));
        });

        const avgEnergyPerBlock = totalEnergyForDay / totalBlocksForDay;
        const avgEnergyPerUser = totalUsersForDay.size > 0 ? totalEnergyForDay / totalUsersForDay.size : 0;

        // Use the median block height and time for this day
        const blockHeights = Array.from(blockGroups.keys()).sort((a, b) => a - b);
        const medianBlockHeight = blockHeights[Math.floor(blockHeights.length / 2)];
        const medianBlockLogs = blockGroups.get(medianBlockHeight)!;
        const medianTimestamp = medianBlockLogs[0].block_time || 0;

        timePoints.push({
            blockHeight: medianBlockHeight,
            timestamp: medianTimestamp,
            date: dateKey,
            contractId,
            energyPerBlock: avgEnergyPerBlock,
            energyPerUser: avgEnergyPerUser,
            activeUsers: totalUsersForDay.size,
            totalEnergyInBlock: totalEnergyForDay
        });
    });

    return timePoints.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Calculate rate history with trend analysis for a token
 */
export function calculateTokenRateHistory(
    contractId: string,
    logs: EnergyLog[],
    tokenMetadata?: TokenCacheData
): TokenRateHistory {
    const timeSeries = generateEnergyRateTimeSeries(logs, contractId, 30);
    
    if (timeSeries.length === 0) {
        return {
            contractId,
            tokenSymbol: tokenMetadata?.symbol || contractId.split('.')[1] || 'UNKNOWN',
            tokenName: tokenMetadata?.name || contractId.split('.')[1] || 'Unknown Token',
            rateHistory: [],
            averageRate: 0,
            trendDirection: 'stable',
            volatility: 0
        };
    }

    const rates = timeSeries.map(point => point.energyPerBlock);
    const averageRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;

    // Calculate trend direction (compare first half vs second half)
    const midPoint = Math.floor(rates.length / 2);
    const firstHalfAvg = rates.slice(0, midPoint).reduce((sum, rate) => sum + rate, 0) / midPoint;
    const secondHalfAvg = rates.slice(midPoint).reduce((sum, rate) => sum + rate, 0) / (rates.length - midPoint);
    
    const trendThreshold = averageRate * 0.1; // 10% change threshold
    let trendDirection: 'up' | 'down' | 'stable';
    
    if (secondHalfAvg > firstHalfAvg + trendThreshold) {
        trendDirection = 'up';
    } else if (secondHalfAvg < firstHalfAvg - trendThreshold) {
        trendDirection = 'down';
    } else {
        trendDirection = 'stable';
    }

    // Calculate volatility (coefficient of variation)
    const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - averageRate, 2), 0) / rates.length;
    const standardDeviation = Math.sqrt(variance);
    const volatility = averageRate > 0 ? (standardDeviation / averageRate) * 100 : 0;

    return {
        contractId,
        tokenSymbol: tokenMetadata?.symbol || contractId.split('.')[1] || 'UNKNOWN',
        tokenName: tokenMetadata?.name || contractId.split('.')[1] || 'Unknown Token',
        rateHistory: timeSeries,
        averageRate,
        trendDirection,
        volatility
    };
}

/**
 * Compare multiple tokens' energy generation rates
 */
export function compareTokenEnergyRates(
    analyticsData: Array<{ contractId: string; analyticsData: EnergyAnalyticsData | null }>,
    tokenMetadata: TokenCacheData[]
): TokenRateHistory[] {
    return analyticsData
        .filter(({ analyticsData }) => analyticsData !== null)
        .map(({ contractId, analyticsData }) => {
            const metadata = tokenMetadata.find(token => token.contractId === contractId);
            return calculateTokenRateHistory(contractId, analyticsData!.logs, metadata);
        })
        .sort((a, b) => b.averageRate - a.averageRate); // Sort by highest average rate first
}