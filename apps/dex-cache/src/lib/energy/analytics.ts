import { getTransactionDetails } from "@repo/polyglot";
import { fetchContractEvents } from "@repo/polyglot";
import { hexToCV } from "@stacks/transactions";

/**
 * Fetches and formats hold-to-earn contract logs for energy analytics
 * @param contractId The contract ID to fetch events from
 * @param limit Optional number of events to fetch (default: 200)
 * @param offset Optional offset for pagination
 * @returns Formatted contract logs with transaction details
 */
export const fetcHoldToEarnLogs = async (contractId: string, limit = 200, offset = 0) => {
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
        const validLogs = allLogs.filter(log => log !== null) as any[];

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
export const calculateEnergyStats = (logs: any[]) => {
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
export const calculateEnergyRates = (logs: any[]) => {
    if (!logs || logs.length < 2) {
        return {
            overallEnergyPerMinute: 0,
            overallIntegralPerMinute: 0,
            topUserRates: [],
            lastCalculated: Date.now(),
            rateHistoryTimeframes: {
                daily: [],
                weekly: [],
                monthly: []
            }
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

    if (firstLog && lastLog && firstLog.block_time && lastLog.block_time) {
        const timeSpanMinutes = Math.max(1, (lastLog.block_time - firstLog.block_time) / 60);
        const totalEnergyHarvested = logs.reduce((sum, log) => sum + Number(log.energy), 0);
        const totalIntegralCalculated = logs.reduce((sum, log) => sum + Number(log.integral), 0);

        overallEnergyPerMinute = totalEnergyHarvested / timeSpanMinutes;
        overallIntegralPerMinute = totalIntegralCalculated / timeSpanMinutes;
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

    // Generate rate history (simplified approach)
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // In a real implementation, you would aggregate actual data from logs over time periods
    // For now, we'll create simple variants based on the overall rate
    const dailyRateHistory = Array(10).fill(0).map((_, i) => ({
        timestamp: now - (10 - i) * 2 * 60 * 60 * 1000, // 2-hour intervals
        rate: overallEnergyPerMinute * (0.8 + Math.random() * 0.4) // Slight random variation
    }));

    const weeklyRateHistory = Array(10).fill(0).map((_, i) => ({
        timestamp: now - (10 - i) * day, // daily points
        rate: overallEnergyPerMinute * (0.7 + Math.random() * 0.6)
    }));

    const monthlyRateHistory = Array(10).fill(0).map((_, i) => ({
        timestamp: now - (10 - i) * 3 * day, // 3-day points
        rate: overallEnergyPerMinute * (0.6 + Math.random() * 0.8)
    }));

    return {
        overallEnergyPerMinute,
        overallIntegralPerMinute,
        topUserRates,
        lastCalculated: Date.now(),
        rateHistoryTimeframes: {
            daily: dailyRateHistory,
            weekly: weeklyRateHistory,
            monthly: monthlyRateHistory
        }
    };
};

/**
 * Extracts user-specific energy statistics from logs
 * @param logs All energy logs 
 * @param userAddress The address to get stats for
 * @returns User statistics or null if no data
 */
export const getUserEnergyStats = (logs: any[], userAddress: string) => {
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
        const timeSpanMinutes = Math.max(1, (sortedLogs[sortedLogs.length - 1].block_time - sortedLogs[0].block_time) / 60);
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
 * Processes all energy data in one go for efficiency
 * @param contractId The contract ID to analyze 
 * @param userAddress Optional user address to get stats for
 * @returns Combined analytics data
 */
export const processAllEnergyData = async (contractId: string, userAddress?: string) => {
    try {
        // Fetch all logs at once
        const logs = await fetcHoldToEarnLogs(contractId);

        if (!logs || logs.length === 0) {
            return {
                logs: [],
                stats: calculateEnergyStats([]),
                rates: calculateEnergyRates([]),
                userStats: userAddress ? { [userAddress]: null } : {}
            };
        }

        // Calculate all stats in parallel
        const stats = calculateEnergyStats(logs);
        const rates = calculateEnergyRates(logs);

        // Process user stats if address provided
        let userStats: Record<string, any> = {};
        if (userAddress) {
            const userData = getUserEnergyStats(logs, userAddress);
            if (userData) {
                userStats[userAddress] = userData;
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
                userStats[address] = getUserEnergyStats(logs, address);
            }
        }

        return {
            logs,
            stats,
            rates,
            userStats
        };
    } catch (error) {
        console.error(`Error processing energy data for ${contractId}:`, error);
        throw error;
    }
};