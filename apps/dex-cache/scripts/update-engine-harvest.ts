#!/usr/bin/env ts-node

import { kv } from '@vercel/kv';

/**
 * Update individual engine harvest timestamp after successful tap
 * This helps track per-engine accumulated energy more accurately
 */

interface EngineHarvestData {
    contractId: string;
    lastHarvestTimestamp: number;
    harvestedAmount: number;
}

/**
 * Update the last harvest timestamp for a specific engine
 */
export async function updateEngineHarvestTimestamp(
    userAddress: string,
    engineContractId: string,
    harvestTimestamp: number = Date.now(),
    harvestedAmount: number = 1000000000 // Default 1000 energy in micro-units
): Promise<void> {
    const key = `engine:harvest:${userAddress}:${engineContractId}`;
    
    const harvestData: EngineHarvestData = {
        contractId: engineContractId,
        lastHarvestTimestamp: harvestTimestamp,
        harvestedAmount
    };
    
    try {
        await kv.set(key, harvestData, { ex: 86400 * 7 }); // Expire after 7 days
        console.log(`✅ Updated harvest timestamp for ${engineContractId}: ${new Date(harvestTimestamp).toISOString()}`);
    } catch (error) {
        console.error(`❌ Failed to update harvest timestamp:`, error);
        throw error;
    }
}

/**
 * Get the last harvest timestamp for a specific engine
 */
export async function getEngineHarvestTimestamp(
    userAddress: string,
    engineContractId: string
): Promise<number | null> {
    const key = `engine:harvest:${userAddress}:${engineContractId}`;
    
    try {
        const harvestData = await kv.get<EngineHarvestData>(key);
        return harvestData?.lastHarvestTimestamp || null;
    } catch (error) {
        console.error(`❌ Failed to get harvest timestamp:`, error);
        return null;
    }
}

/**
 * Get all engine harvest data for a user
 */
export async function getAllEngineHarvests(userAddress: string): Promise<Record<string, EngineHarvestData>> {
    const pattern = `engine:harvest:${userAddress}:*`;
    const results: Record<string, EngineHarvestData> = {};
    
    try {
        // Note: This is a simplified version - in production you'd want to use SCAN
        // For now, we'll just return empty and let the system handle fallbacks
        console.log(`Getting engine harvests for pattern: ${pattern}`);
        return results;
    } catch (error) {
        console.error(`❌ Failed to get all engine harvests:`, error);
        return results;
    }
}

// Run if called directly
if (require.main === module) {
    const testAddress = process.env.USER_ADDRESS || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
    const testEngine = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-energizer';
    
    updateEngineHarvestTimestamp(testAddress, testEngine)
        .then(() => console.log('Test update completed'))
        .catch(console.error);
}

export { updateEngineHarvestTimestamp, getEngineHarvestTimestamp, getAllEngineHarvests };