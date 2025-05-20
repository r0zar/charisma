import { getTransactionDetails } from "@repo/polyglot";
import { fetchContractEvents } from "@repo/polyglot";
import { hexToCV } from "@stacks/transactions";

// ---- Interfaces for Energy Analytics Data ----
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

export interface EnergyStats {
    totalEnergyHarvested: number;
    totalIntegralCalculated: number;
    uniqueUsers: number;
    averageEnergyPerHarvest: number;
    averageIntegralPerHarvest: number;
    lastUpdated: number; // Timestamp
}

export interface UserEnergyRate {
    address: string;
    energyPerMinute: number;
}

export interface EnergyRateDetails {
    overallEnergyPerMinute: number;
    overallIntegralPerMinute: number;
    topUserRates: UserEnergyRate[];
    lastCalculated: number; // Timestamp
}

export interface HarvestHistoryEntry {
    timestamp: number;
    energy: number;
    integral: number;
    blockHeight: number;
    txId: string;
}

export interface UserEnergyStats {
    address: string;
    totalEnergyHarvested: number;
    totalIntegralCalculated: number;
    harvestCount: number;
    averageEnergyPerHarvest: number;
    lastHarvestTimestamp: number;
    estimatedEnergyRate: number;
    estimatedIntegralRate: number;
    harvestHistory: HarvestHistoryEntry[];
}

export interface EnergyAnalyticsData {
    logs: EnergyLog[];
    stats: EnergyStats;
    rates: EnergyRateDetails;
    userStats: Record<string, UserEnergyStats | null>; // User address -> UserEnergyStats or null if no data
}
// ---- End of Interfaces ----

/**
 * Fetches and formats hold-to-earn contract logs for energy analytics
 * @param contractId The contract ID to fetch events from
 * @param limit Optional number of events to fetch (default: 200)
 * @param offset Optional offset for pagination
 * @returns Formatted contract logs with transaction details
 */
export const fetcHoldToEarnLogs = async (contractId: string, limit = 100, offset = 0): Promise<EnergyLog[]> => {
    if (!contractId) {
        throw new Error("Contract ID is required");
    }

    // Split contractId into address and name
    const [contractAddress, contractName] = contractId.split('.');

    if (!contractAddress || !contractName) {
        throw new Error("Invalid contract ID format. Expected 'address.name'");
    }

    console.log(`Fetching energy logs for contract: ${contractId}, limit: ${limit}, offset: ${offset}`);

    try {
        // Fetch contract events
        const data = await fetchContractEvents(contractId, { limit, offset });

        if (!data || !data.results || !Array.isArray(data.results)) {
            console.warn(`No event data returned for ${contractId}`);
            return [];
        }

        console.log(`Found ${data.results.length} events for contract ${contractId}`);

        // Extract and parse the logs
        const logPromises = data.results.map(async (r: any) => {
            if (!r.contract_log || !r.contract_log.value || !r.contract_log.value.hex) {
                return null; // Skip invalid logs
            }

            try {
                // Parse the hex value to clarity value
                const clarityValue = hexToCV(r.contract_log.value.hex) as any;

                // Skip if not an object with value
                if (typeof clarityValue !== 'object' || !('value' in clarityValue)) {
                    return null;
                }

                // Extract log data
                const logValue = clarityValue.value;

                // Format the log data
                const formattedLog = {
                    tx_id: r.tx_id,
                    block_height: r.block_height,
                    energy: logValue.energy?.value ? Number(logValue.energy.value) : 0,
                    integral: logValue.integral?.value ? Number(logValue.integral.value) : 0,
                    message: logValue.message?.value || '',
                    op: logValue.op?.value || '',
                    sender: logValue.sender?.value || '',
                };

                // Get detailed transaction information
                try {
                    const txDetails = await getTransactionDetails(r.tx_id);

                    return {
                        ...formattedLog,
                        block_time: txDetails?.block_time || null,
                        block_time_iso: txDetails?.block_time_iso || null,
                        tx_status: txDetails?.tx_status || null,
                    };
                } catch (txError) {
                    console.warn(`Failed to get transaction details for ${r.tx_id}:`, txError);
                    return formattedLog; // Return basic log without transaction details
                }
            } catch (parseError) {
                console.warn(`Failed to parse log for tx ${r.tx_id}:`, parseError);
                return null; // Skip invalid logs
            }
        });

        // Wait for all log processing to complete and filter out nulls
        const allLogs = await Promise.all(logPromises);
        const validLogs = allLogs.filter(log => log !== null) as EnergyLog[];

        console.log(`Successfully processed ${validLogs.length} energy logs`);
        return validLogs;
    } catch (error) {
        console.error(`Error fetching hold-to-earn logs for ${contractId}:`, error);
        throw error;
    }
};

/**
 * Calculates energy statistics from the logs
 * @param logs Array of energy harvest logs
 * @returns Object containing key statistics
 */
export const calculateEnergyStats = (logs: EnergyLog[]): EnergyStats => {
    if (!logs || logs.length === 0) {
        return {
            totalEnergyHarvested: 0,
            totalIntegralCalculated: 0,
            uniqueUsers: 0,
            averageEnergyPerHarvest: 0,
            averageIntegralPerHarvest: 0,
            lastUpdated: Date.now(),
        };
    }

    // Get unique users
    const uniqueUsers = new Set(logs.map(log => log.sender)).size;

    // Calculate totals
    const totalEnergyHarvested = logs.reduce((sum, log) => sum + Number(log.energy), 0);
    const totalIntegralCalculated = logs.reduce((sum, log) => sum + Number(log.integral), 0);

    // Calculate averages
    const averageEnergyPerHarvest = logs.length > 0 ? totalEnergyHarvested / logs.length : 0;
    const averageIntegralPerHarvest = logs.length > 0 ? totalIntegralCalculated / logs.length : 0;

    return {
        totalEnergyHarvested,
        totalIntegralCalculated,
        uniqueUsers,
        averageEnergyPerHarvest,
        averageIntegralPerHarvest,
        lastUpdated: Date.now(),
    };
};

/**
 * Calculates energy rates from logs
 * @param logs Array of energy harvest logs
 * @returns Object containing rate information
 */
export const calculateEnergyRates = (logs: EnergyLog[]): EnergyRateDetails => {
    if (!logs || logs.length < 2) {
        return {
            overallEnergyPerMinute: 0,
            overallIntegralPerMinute: 0,
            topUserRates: [],
            lastCalculated: Date.now(),
        };
    }

    // Sort logs by time
    const sortedLogs = [...logs].sort((a, b) => {
        return (a.block_time || 0) - (b.block_time || 0);
    });

    const firstLog = sortedLogs[0];
    const lastLog = sortedLogs[sortedLogs.length - 1];

    // Calculate global rates
    let overallEnergyPerMinute = 0;
    let overallIntegralPerMinute = 0;

    const totalEnergyHarvested = logs.reduce((sum, log) => sum + Number(log.energy), 0);
    const totalIntegralCalculated = logs.reduce((sum, log) => sum + Number(log.integral), 0);

    if (firstLog && lastLog && firstLog.block_time && lastLog.block_time) {
        // Ensure we have a reasonable time difference
        const timeSpanSeconds = Math.max(1, lastLog.block_time - firstLog.block_time);
        const timeSpanMinutes = timeSpanSeconds / 60;

        // Debug logging
        console.log('Rate calculation inputs:', {
            firstLogTime: firstLog.block_time,
            lastLogTime: lastLog.block_time,
            timeSpanSeconds,
            timeSpanMinutes,
            totalEnergyHarvested,
            totalIntegralCalculated,
        });

        // Only calculate rates if we have a significant time span (at least 1 minute)
        // to avoid division by extremely small numbers
        if (timeSpanMinutes >= 1) {
            overallEnergyPerMinute = totalEnergyHarvested / timeSpanMinutes;
            overallIntegralPerMinute = totalIntegralCalculated / timeSpanMinutes;
        } else if (totalEnergyHarvested > 0) {
            // If time span is too small but we have energy, use a conservative estimate
            // Calculate an hourly rate based on the energy harvested
            overallEnergyPerMinute = totalEnergyHarvested / 60; // Assume it took ~1 hour
            console.log('Using conservative rate estimate due to small time span:', overallEnergyPerMinute);
        }
    } else if (totalEnergyHarvested > 0) {
        // If we have energy but can't calculate a rate due to missing timestamps,
        // use a conservative fallback based on the amount harvested
        overallEnergyPerMinute = totalEnergyHarvested / 60; // Conservative estimate (1 hour)
        console.log('Using fallback rate due to missing timestamps:', overallEnergyPerMinute);
    }

    // Group logs by user
    const userLogs = logs.reduce((acc: Record<string, any[]>, log) => {
        if (!acc[log.sender]) {
            acc[log.sender] = [];
        }
        acc[log.sender].push(log);
        return acc;
    }, {});

    // Calculate per-user rates
    const userRates = Object.entries(userLogs).map(([address, userLogs]) => {
        const userSortedLogs = [...userLogs].sort((a, b) => (a.block_time || 0) - (b.block_time || 0));

        if (userSortedLogs.length < 2 || !userSortedLogs[0].block_time || !userSortedLogs[userSortedLogs.length - 1].block_time) {
            return { address, energyPerMinute: 0 };
        }

        const userTimeSpanMinutes = Math.max(1, (userSortedLogs[userSortedLogs.length - 1].block_time - userSortedLogs[0].block_time) / 60);
        const userTotalEnergy = userSortedLogs.reduce((sum, log) => sum + Number(log.energy), 0);

        return {
            address,
            energyPerMinute: userTotalEnergy / userTimeSpanMinutes
        };
    });

    // Sort by rate and get top 5
    const topUserRates = userRates
        .sort((a, b) => b.energyPerMinute - a.energyPerMinute)
        .slice(0, 5);

    return {
        overallEnergyPerMinute,
        overallIntegralPerMinute,
        topUserRates,
        lastCalculated: Date.now(),
    };
};

/**
 * Extracts user-specific energy statistics from logs
 * @param logs All energy logs 
 * @param userAddress The address to get stats for
 * @returns User statistics or null if no data
 */
export const getUserEnergyStats = (logs: EnergyLog[], userAddress: string): UserEnergyStats | null => {
    if (!logs || logs.length === 0 || !userAddress) {
        return null;
    }

    // Filter logs for the specific user
    const userLogs = logs.filter(log => log.sender === userAddress);

    if (userLogs.length === 0) {
        return null;
    }

    // Sort logs by block height or time
    const sortedLogs = [...userLogs].sort((a, b) => {
        return (a.block_height || 0) - (b.block_height || 0);
    });

    // Calculate user stats
    const totalEnergyHarvested = userLogs.reduce((sum, log) => sum + Number(log.energy), 0);
    const totalIntegralCalculated = userLogs.reduce((sum, log) => sum + Number(log.integral), 0);
    const harvestCount = userLogs.length;
    const averageEnergyPerHarvest = harvestCount > 0 ? totalEnergyHarvested / harvestCount : 0;

    // Calculate energy rate
    let estimatedEnergyRate = 0;
    let estimatedIntegralRate = 0;

    if (sortedLogs.length > 1 && sortedLogs[0].block_time && sortedLogs[sortedLogs.length - 1].block_time) {
        const timeSpanMinutes = Math.max(1, (sortedLogs[sortedLogs.length - 1]?.block_time! - sortedLogs[0].block_time) / 60);
        estimatedEnergyRate = totalEnergyHarvested / timeSpanMinutes;
        estimatedIntegralRate = totalIntegralCalculated / timeSpanMinutes;
    }

    // Format harvest history
    const harvestHistory = sortedLogs.map(log => ({
        timestamp: log.block_time_iso
            ? new Date(log.block_time_iso).getTime()
            : log.block_time ? log.block_time * 1000 : Date.now(),
        energy: Number(log.energy),
        integral: Number(log.integral),
        blockHeight: log.block_height,
        txId: log.tx_id
    }));

    // Get last harvest timestamp
    const lastHarvestTimestamp = harvestHistory.length > 0
        ? harvestHistory[harvestHistory.length - 1].timestamp
        : Date.now();

    return {
        address: userAddress,
        totalEnergyHarvested,
        totalIntegralCalculated,
        harvestCount,
        averageEnergyPerHarvest,
        lastHarvestTimestamp,
        estimatedEnergyRate,
        estimatedIntegralRate,
        harvestHistory
    };
};

/**
 * Processes all energy data for a given contract, including logs, stats, rates, and user-specific stats.
 * If userAddress is provided, only that user's stats will be populated in detail.
 * Otherwise, it attempts to calculate stats for all users found in the fetched logs.
 */
export const processAllEnergyData = async (contractId: string, userAddress?: string): Promise<EnergyAnalyticsData> => {
    console.log(`Starting to process all energy data for ${contractId}${userAddress ? ` (focusing on user ${userAddress})` : ''}`);
    const startTime = Date.now();

    // Fetch a larger set of logs to increase accuracy of lastHarvestTimestamp
    const logs = await fetcHoldToEarnLogs(contractId, 500); // Increased limit to 500

    console.log(`Fetched ${logs.length} logs for ${contractId} in ${Date.now() - startTime}ms`);

    const stats = calculateEnergyStats(logs);
    const rates = calculateEnergyRates(logs);
    const allUserStats: Record<string, UserEnergyStats | null> = {};

    if (userAddress) {
        const userData = getUserEnergyStats(logs, userAddress);
        if (userData) {
            allUserStats[userAddress] = userData;
        }
    } else {
        // If no specific user requested, process stats for all users
        // Group logs by user
        const userLogs = logs.reduce((acc: Record<string, any[]>, log) => {
            if (!acc[log.sender]) {
                acc[log.sender] = [];
            }
            acc[log.sender].push(log);
            return acc;
        }, {});

        // Process each user (up to a reasonable limit to avoid excessive processing)
        const userLimit = 20; // Limit number of users to process
        const topUsers = Object.keys(userLogs)
            .sort((a, b) => userLogs[b].length - userLogs[a].length)
            .slice(0, userLimit);

        for (const address of topUsers) {
            allUserStats[address] = getUserEnergyStats(logs, address);
        }
    }

    return {
        logs,
        stats,
        rates,
        userStats: allUserStats
    };
};