'use server';

import { callReadOnlyFunction } from '@repo/polyglot';
import { optionalCVOf, uintCV, principalCV } from '@stacks/transactions';
import { bufferFromHex } from '@stacks/transactions/dist/cl';

// Constants for operations
const OP_HARVEST_ENERGY = '07';

const MINUTES_PER_DAY = 24 * 60;
const STACKS_BLOCKS_PER_DAY = 144; // Approx. 10 min per block
const MINUTES_PER_BLOCK = MINUTES_PER_DAY / STACKS_BLOCKS_PER_DAY;

interface EnergyData {
    pendingBlocks: number;
    lastTapBlock: number;
    estimatedEnergy: number | null;
    estimatedDailyReward: number | null;
    energyPerMinuteRate: number | null;
}

/**
 * Server action to fetch energy data for a user from a specific vault
 */
export async function getEnergyData(
    walletAddress: string,
    contractId: string,
    engineContractId?: string
): Promise<EnergyData> {
    if (!walletAddress || !contractId) {
        return {
            pendingBlocks: 0,
            lastTapBlock: 0,
            estimatedEnergy: null,
            estimatedDailyReward: null,
            energyPerMinuteRate: null
        };
    }

    // Use the engine contract ID if provided, otherwise use the vault contract ID
    const targetContractId = engineContractId || contractId;
    const [contractAddress, contractName] = targetContractId.split('.');

    try {
        // Get the last time the user tapped for energy
        const lastTapResult = await callReadOnlyFunction(
            contractAddress,
            contractName,
            'get-last-tap-block',
            [principalCV(walletAddress)]
        );

        let lastTapBlock = 0;
        if (lastTapResult && typeof lastTapResult === 'object' && 'value' in lastTapResult) {
            lastTapBlock = parseInt(lastTapResult.value.toString());
        }

        // Get the current block height and pending blocks via quote function
        const quoteResult = await callReadOnlyFunction(
            contractAddress,
            contractName,
            'quote',
            [
                uintCV(0), // amount doesn't matter for energy harvest
                optionalCVOf(bufferFromHex(OP_HARVEST_ENERGY))
            ]
        );

        let pendingBlocks = 0;

        if (quoteResult && typeof quoteResult === 'object' && 'value' in quoteResult) {
            // For the energy quote, we expect dk to contain block difference
            const dkValue = quoteResult.value.dk?.value;
            if (dkValue !== undefined) {
                pendingBlocks = parseInt(dkValue.toString());
            }
        }

        // Fetch user-specific energy rate from API
        let energyPerMinuteRate = null;
        let estimatedEnergy = null;
        let estimatedDailyReward = null;

        try {
            const userStatsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/energy/${contractId}/user?address=${walletAddress}`);
            if (userStatsResponse.ok) {
                const userData = await userStatsResponse.json();
                if (userData.status === 'success' && userData.data && typeof userData.data.estimatedEnergyRate === 'number') {
                    energyPerMinuteRate = userData.data.estimatedEnergyRate;

                    const totalPendingMinutes = pendingBlocks * MINUTES_PER_BLOCK;
                    estimatedEnergy = Math.floor(energyPerMinuteRate * totalPendingMinutes);
                    estimatedDailyReward = Math.floor(energyPerMinuteRate * MINUTES_PER_DAY);
                }
            }
        } catch (apiError) {
            console.error("Error fetching user energy rate from API:", apiError);
            // Continue with null values for these fields
        }

        return {
            pendingBlocks,
            lastTapBlock,
            estimatedEnergy,
            estimatedDailyReward,
            energyPerMinuteRate
        };
    } catch (error) {
        console.error("Error in server action getEnergyData:", error);
        // Return default values in case of error
        return {
            pendingBlocks: 0,
            lastTapBlock: 0,
            estimatedEnergy: null,
            estimatedDailyReward: null,
            energyPerMinuteRate: null
        };
    }
}

/**
 * Server action to fetch only the pending energy blocks (lighter-weight polling)
 */
export async function getPendingEnergyBlocks(
    walletAddress: string,
    lastTapBlock: number,
    contractId: string,
    engineContractId?: string
): Promise<{
    pendingBlocks: number;
    estimatedEnergy: number | null;
    ratePerMinute: number | null;
}> {
    if (!walletAddress || !contractId || lastTapBlock === null) {
        return {
            pendingBlocks: 0,
            estimatedEnergy: null,
            ratePerMinute: null
        };
    }

    // Use the engine contract ID if provided, otherwise use the vault contract ID
    const targetContractId = engineContractId || contractId;
    const [contractAddress, contractName] = targetContractId.split('.');

    try {
        // Get the pending blocks via quote function
        const quoteResult = await callReadOnlyFunction(
            contractAddress,
            contractName,
            'quote',
            [
                uintCV(0), // amount doesn't matter for energy harvest
                optionalCVOf(bufferFromHex(OP_HARVEST_ENERGY))
            ]
        );

        let pendingBlocks = 0;

        if (quoteResult && typeof quoteResult === 'object' && 'value' in quoteResult) {
            const dkValue = quoteResult.value.dk?.value;
            if (dkValue !== undefined) {
                pendingBlocks = parseInt(dkValue.toString());
            }
        }

        // Try to get the rate from API (for estimating energy)
        let ratePerMinute = null;
        let estimatedEnergy = null;

        try {
            const userStatsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/energy/${contractId}/user?address=${walletAddress}`);
            if (userStatsResponse.ok) {
                const userData = await userStatsResponse.json();
                if (userData.status === 'success' && userData.data && typeof userData.data.estimatedEnergyRate === 'number') {
                    ratePerMinute = userData.data.estimatedEnergyRate;
                    const totalPendingMinutes = pendingBlocks * MINUTES_PER_BLOCK;
                    estimatedEnergy = Math.floor(ratePerMinute * totalPendingMinutes);
                }
            }
        } catch (apiError) {
            console.error("Error fetching user energy rate for polling:", apiError);
            // Continue with null values
        }

        return {
            pendingBlocks,
            estimatedEnergy,
            ratePerMinute
        };
    } catch (error) {
        console.error("Error in server action getPendingEnergyBlocks:", error);
        return {
            pendingBlocks: 0,
            estimatedEnergy: null,
            ratePerMinute: null
        };
    }
} 