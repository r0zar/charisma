// Server-side Raven cache management
import { callReadOnlyFunction } from '@repo/polyglot';
import { uintCV } from '@stacks/transactions';
import { kv } from '@vercel/kv';

interface RavenOwnership {
    id: number;
    owner: string | null;
    lastUpdated: number;
}

interface ServerRavenCache {
    ownership: Map<number, RavenOwnership>;
    userToRavens: Map<string, number[]>;
    lastFullUpdate: number;
    isUpdating: boolean;
}

// Server-side cache instance
let serverRavenCache: ServerRavenCache = {
    ownership: new Map(),
    userToRavens: new Map(),
    lastFullUpdate: 0,
    isUpdating: false
};

// Cache settings
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RAVEN_ID = 100;
const BATCH_SIZE = 20; // Larger batches since we're server-side
const KV_CACHE_KEY = 'raven-ownership-cache';
const KV_CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

export async function updateServerRavenCache(): Promise<void> {
    if (serverRavenCache.isUpdating) {
        console.log('🔄 Server Raven cache update already in progress...');
        return;
    }

    serverRavenCache.isUpdating = true;
    const updateStartTime = Date.now();
    console.log('🔍 Starting server-side Raven ownership cache update...');

    try {
        const newOwnership = new Map<number, RavenOwnership>();
        const newUserToRavens = new Map<string, number[]>();

        // Process Ravens in larger batches with parallel requests (server-side can handle it)
        for (let i = 1; i <= MAX_RAVEN_ID; i += BATCH_SIZE) {
            const batchPromises = [];

            // Process Ravens in parallel within batch
            for (let j = i; j < Math.min(i + BATCH_SIZE, MAX_RAVEN_ID + 1); j++) {
                batchPromises.push(
                    callReadOnlyFunction(
                        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
                        'odins-raven',
                        'get-owner',
                        [uintCV(j)],
                    ).then(result => ({
                        id: j,
                        owner: result && result.value && result.value.value ? result.value.value : null,
                        lastUpdated: Date.now()
                    })).catch(error => {
                        console.warn(`Failed to get owner for Raven #${j}:`, error.message);
                        return {
                            id: j,
                            owner: null,
                            lastUpdated: Date.now()
                        };
                    })
                );
            }

            const batchResults = await Promise.all(batchPromises);

            // Process batch results
            for (const ownership of batchResults) {
                newOwnership.set(ownership.id, ownership);

                if (ownership.owner) {
                    const existingRavens = newUserToRavens.get(ownership.owner) || [];
                    existingRavens.push(ownership.id);
                    newUserToRavens.set(ownership.owner, existingRavens);
                }
            }

            console.log(`📊 Server processed Ravens ${i}-${Math.min(i + BATCH_SIZE - 1, MAX_RAVEN_ID)}`);
        }

        // Convert Maps to plain objects for KV storage
        const cacheData = {
            ownership: Object.fromEntries(newOwnership),
            userToRavens: Object.fromEntries(newUserToRavens),
            lastFullUpdate: Date.now()
        };

        // Update local cache
        serverRavenCache.ownership = newOwnership;
        serverRavenCache.userToRavens = newUserToRavens;
        serverRavenCache.lastFullUpdate = cacheData.lastFullUpdate;

        // Store in Vercel KV with 24-hour TTL
        try {
            await kv.set(KV_CACHE_KEY, cacheData, { ex: KV_CACHE_TTL });
            console.log('💾 Raven cache saved to Vercel KV');
        } catch (kvError) {
            console.warn('⚠️ Failed to save to Vercel KV:', kvError);
        }

        const updateDuration = Date.now() - updateStartTime;
        console.log(`✅ Server Raven cache updated successfully in ${(updateDuration / 1000).toFixed(1)}s!`);
        console.log(`📊 Total Ravens tracked: ${newOwnership.size}`);
        console.log(`👥 Total owners: ${newUserToRavens.size}`);

        // Log some statistics
        const ownedRavens = Array.from(newOwnership.values()).filter(r => r.owner !== null);
        console.log(`🎯 Ravens with owners: ${ownedRavens.length}/${MAX_RAVEN_ID}`);

    } catch (error) {
        console.error('❌ Failed to update server Raven cache:', error);
    } finally {
        serverRavenCache.isUpdating = false;
        console.log('🔓 Server Raven cache update lock released');
    }
}

export function getServerRavenOwnership(ravenId: number): string | null {
    const ownership = serverRavenCache.ownership.get(ravenId);
    return ownership?.owner || null;
}

export function getServerUserRavenIds(userAddress: string): number[] {
    return serverRavenCache.userToRavens.get(userAddress) || [];
}

export function getServerHighestRavenId(userAddress: string): number {
    const ravenIds = getServerUserRavenIds(userAddress);
    return ravenIds.length > 0 ? Math.max(...ravenIds) : 0;
}

async function loadFromVercelKV(): Promise<boolean> {
    try {
        const cached = await kv.get(KV_CACHE_KEY);
        if (cached && typeof cached === 'object') {
            const cacheData = cached as {
                ownership: Record<number, RavenOwnership>;
                userToRavens: Record<string, number[]>;
                lastFullUpdate: number;
            };

            // Convert back to Maps
            serverRavenCache.ownership = new Map(Object.entries(cacheData.ownership).map(([id, data]) => [parseInt(id), data]));
            serverRavenCache.userToRavens = new Map(Object.entries(cacheData.userToRavens));
            serverRavenCache.lastFullUpdate = cacheData.lastFullUpdate;

            console.log(`📥 Loaded Raven cache from Vercel KV: ${serverRavenCache.ownership.size} Ravens, ${serverRavenCache.userToRavens.size} owners`);
            return true;
        }
    } catch (error) {
        console.warn('⚠️ Failed to load from Vercel KV:', error);
    }
    return false;
}

export function shouldUpdateServerCache(): boolean {
    const now = Date.now();
    const cacheAge = now - serverRavenCache.lastFullUpdate;

    return (
        serverRavenCache.ownership.size === 0 || // Empty cache
        cacheAge > CACHE_DURATION // Cache expired (24 hours)
    );
}

export function getServerRavenCacheStatus() {
    const now = Date.now();
    const cacheAge = now - serverRavenCache.lastFullUpdate;
    const cacheAgeHours = Math.floor(cacheAge / (60 * 60 * 1000));
    
    return {
        isUpdating: serverRavenCache.isUpdating,
        lastUpdate: serverRavenCache.lastFullUpdate,
        cacheAgeHours,
        totalRavens: serverRavenCache.ownership.size,
        totalOwners: serverRavenCache.userToRavens.size,
        ownedRavens: Array.from(serverRavenCache.ownership.values()).filter(r => r.owner !== null).length
    };
}

export async function initializeServerRavenCache(): Promise<void> {
    // First try to load from Vercel KV
    const loadedFromKV = await loadFromVercelKV();
    
    // Only update if we couldn't load from KV or cache is expired
    if (!loadedFromKV && shouldUpdateServerCache() && !serverRavenCache.isUpdating) {
        await updateServerRavenCache();
    }
}