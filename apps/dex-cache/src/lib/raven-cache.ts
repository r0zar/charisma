// Raven ID cache system for efficient Raven ownership lookups
import { callReadOnlyFunction } from '@repo/polyglot';
import { uintCV } from '@stacks/transactions';

interface RavenOwnership {
    id: number;
    owner: string | null;
    lastUpdated: number;
}

interface RavenCache {
    ownership: Map<number, RavenOwnership>;
    userToRavens: Map<string, number[]>;
    lastFullUpdate: number;
    isUpdating: boolean;
}

// Cache instance
let ravenCache: RavenCache = {
    ownership: new Map(),
    userToRavens: new Map(),
    lastFullUpdate: 0,
    isUpdating: false
};

// Cache settings
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const MAX_RAVEN_ID = 100;
const BATCH_SIZE = 5; // Smaller batches to avoid rate limiting
const REQUEST_DELAY = 150; // 150ms delay between requests
const BATCH_DELAY = 1000; // 1 second delay between batches

export async function getRavenOwnership(ravenId: number): Promise<string | null> {
    // Check if we need to update the cache
    if (shouldUpdateCache()) {
        await updateRavenCache();
    }

    const ownership = ravenCache.ownership.get(ravenId);
    return ownership?.owner || null;
}

export async function getUserRavenIds(userAddress: string): Promise<number[]> {
    // Client-side cache updates are disabled to avoid rate limiting
    // Rely on server-side cache or manual overrides
    console.log('🔍 Getting user Raven IDs from client cache (no auto-update)');
    return ravenCache.userToRavens.get(userAddress) || [];
}

export async function getHighestRavenId(userAddress: string): Promise<number> {
    const ravenIds = await getUserRavenIds(userAddress);
    return ravenIds.length > 0 ? Math.max(...ravenIds) : 0;
}

function shouldUpdateCache(): boolean {
    // Temporarily disable automatic cache updates to avoid API rate limiting
    // Only update cache when explicitly requested via forceUpdateRavenCache()
    return false;
    
    // Original logic (commented out):
    // const now = Date.now();
    // const cacheAge = now - ravenCache.lastFullUpdate;
    // return (
    //     ravenCache.ownership.size === 0 || // Empty cache
    //     cacheAge > CACHE_DURATION || // Cache expired
    //     ravenCache.isUpdating === false // Not currently updating
    // );
}

export async function updateRavenCache(): Promise<void> {
    if (ravenCache.isUpdating) {
        console.log('🔄 Raven cache update already in progress, waiting for completion...');
        
        // Wait for current update to finish with timeout
        const maxWaitTime = 5 * 60 * 1000; // 5 minutes max wait
        const startWait = Date.now();
        
        while (ravenCache.isUpdating && (Date.now() - startWait) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Check every 500ms
        }
        
        if (ravenCache.isUpdating) {
            console.warn('⚠️ Cache update timed out, forcing new update');
            ravenCache.isUpdating = false; // Force reset if stuck
        } else {
            console.log('✅ Previous cache update completed, using existing data');
            return;
        }
    }

    // Set lock and start update
    ravenCache.isUpdating = true;
    const updateStartTime = Date.now();
    console.log('🔍 Starting Raven ownership cache update...');

    try {
        const newOwnership = new Map<number, RavenOwnership>();
        const newUserToRavens = new Map<string, number[]>();

        // Process Ravens in batches to avoid overwhelming the API
        for (let i = 1; i <= MAX_RAVEN_ID; i += BATCH_SIZE) {
            const batchResults = [];

            // Process each Raven in the batch sequentially with delays
            for (let j = i; j < Math.min(i + BATCH_SIZE, MAX_RAVEN_ID + 1); j++) {
                try {
                    // Add delay between requests to avoid rate limiting
                    if (j > 1) {
                        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
                    }

                    const result = await callReadOnlyFunction(
                        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
                        'odins-raven',
                        'get-owner',
                        [uintCV(j)],
                    );

                    batchResults.push({
                        id: j,
                        owner: result && result.value && result.value.value ? result.value.value : null,
                        lastUpdated: Date.now()
                    });
                } catch (error: any) {
                    console.warn(`Failed to get owner for Raven #${j}:`, error.message);
                    batchResults.push({
                        id: j,
                        owner: null,
                        lastUpdated: Date.now()
                    });
                }
            }

            // Process batch results
            for (const ownership of batchResults) {
                newOwnership.set(ownership.id, ownership);

                if (ownership.owner) {
                    const userRavens = newUserToRavens.get(ownership.owner) || [];
                    userRavens.push(ownership.id);
                    newUserToRavens.set(ownership.owner, userRavens);
                }
            }

            // Delay between batches to respect rate limits
            if (i + BATCH_SIZE <= MAX_RAVEN_ID) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
            console.log(`📊 Processed Ravens ${i}-${Math.min(i + BATCH_SIZE - 1, MAX_RAVEN_ID)}`);
        }

        // Update cache
        ravenCache.ownership = newOwnership;
        ravenCache.userToRavens = newUserToRavens;
        ravenCache.lastFullUpdate = Date.now();

        const updateDuration = Date.now() - updateStartTime;
        console.log(`✅ Raven cache updated successfully in ${(updateDuration / 1000).toFixed(1)}s!`);
        console.log(`📊 Total Ravens tracked: ${newOwnership.size}`);
        console.log(`👥 Total owners: ${newUserToRavens.size}`);

        // Log some statistics
        const ownedRavens = Array.from(newOwnership.values()).filter(r => r.owner !== null);
        console.log(`🎯 Ravens with owners: ${ownedRavens.length}/${MAX_RAVEN_ID}`);

    } catch (error) {
        console.error('❌ Failed to update Raven cache:', error);
        // Don't update cache on error, keep existing data
    } finally {
        ravenCache.isUpdating = false;
        console.log('🔓 Raven cache update lock released');
    }
}

export async function forceUpdateRavenCache(): Promise<void> {
    console.log('🔄 Forcing Raven cache update...');
    ravenCache.lastFullUpdate = 0; // Force update
    await updateRavenCache();
}

export function getRavenCacheStatus() {
    const now = Date.now();
    const cacheAge = now - ravenCache.lastFullUpdate;
    const cacheAgeMinutes = Math.floor(cacheAge / (60 * 1000));
    
    return {
        isUpdating: ravenCache.isUpdating,
        lastUpdate: ravenCache.lastFullUpdate,
        cacheAgeMinutes,
        totalRavens: ravenCache.ownership.size,
        totalOwners: ravenCache.userToRavens.size,
        ownedRavens: Array.from(ravenCache.ownership.values()).filter(r => r.owner !== null).length
    };
}

// Function to populate client cache from server-side data
export function populateClientCacheFromServer(serverData: {
    ownership: Record<number, { id: number; owner: string | null; lastUpdated: number }>;
    userToRavens: Record<string, number[]>;
    lastFullUpdate: number;
}) {
    console.log('📥 Populating client Raven cache from server data...');
    
    // Convert server data to Maps
    ravenCache.ownership.clear();
    ravenCache.userToRavens.clear();
    
    Object.entries(serverData.ownership).forEach(([id, ownership]) => {
        ravenCache.ownership.set(parseInt(id), ownership);
    });
    
    Object.entries(serverData.userToRavens).forEach(([address, ravenIds]) => {
        ravenCache.userToRavens.set(address, ravenIds);
    });
    
    ravenCache.lastFullUpdate = serverData.lastFullUpdate;
    ravenCache.isUpdating = false;
    
    console.log(`✅ Client cache populated with ${ravenCache.ownership.size} Ravens and ${ravenCache.userToRavens.size} owners`);
}

export function getCacheStats() {
    return {
        totalRavens: ravenCache.ownership.size,
        totalOwners: ravenCache.userToRavens.size,
        lastUpdate: ravenCache.lastFullUpdate,
        cacheAge: Date.now() - ravenCache.lastFullUpdate,
        isUpdating: ravenCache.isUpdating
    };
}

// Utility function to get all Ravens owned by a user with detailed info
export async function getUserRavenDetails(userAddress: string): Promise<RavenOwnership[]> {
    const ravenIds = await getUserRavenIds(userAddress);
    return ravenIds.map(id => ravenCache.ownership.get(id)!).filter(Boolean);
}