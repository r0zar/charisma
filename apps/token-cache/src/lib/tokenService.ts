import { Cryptonomicon } from "../lib/cryptonomicon";
import { kv } from "@vercel/kv";
import { TokenCacheData } from "@repo/tokens";
const cryptonomicon = new Cryptonomicon({
    debug: true,
    apiKey: process.env.HIRO_API_KEY,
});

// Define the cache duration (30 days in seconds)
const CACHE_DURATION_SECONDS = 30 * 24 * 60 * 60;
export const TOKEN_LIST_KEY = "token-list:sip10";
export const BLACKLIST_KEY = "token-blacklist:sip10";

/**
 * Fetches the list of managed token contract IDs from Vercel KV.
 * @returns A promise resolving to an array of contract ID strings.
 */
const getManagedTokenIds = async (): Promise<string[]> => {
    try {
        const tokenIds = await kv.get<string[]>(TOKEN_LIST_KEY);
        return Array.isArray(tokenIds) ? tokenIds : []; // Return empty array if not found or not an array
    } catch (error) {
        console.error(`Error fetching token list from KV (${TOKEN_LIST_KEY}):`, error);
        return []; // Return empty array on error
    }
};

/**
 * Fetches the list of blacklisted token contract IDs from Vercel KV.
 * @returns A promise resolving to an array of blacklisted contract ID strings.
 */
export const getBlacklistedTokenIds = async (): Promise<string[]> => {
    try {
        const blacklistedIds = await kv.get<string[]>(BLACKLIST_KEY);
        return Array.isArray(blacklistedIds) ? blacklistedIds : [];
    } catch (error) {
        console.error(`Error fetching blacklist from KV (${BLACKLIST_KEY}):`, error);
        return [];
    }
};

/**
 * Adds a contract ID to the blacklist and removes it from the managed list.
 * @param contractId - The contract ID to blacklist.
 * @returns Success status and message.
 */
export const addToBlacklist = async (contractId: string): Promise<{ success: boolean; message: string }> => {
    if (!contractId) {
        return { success: false, message: 'Contract ID is required' };
    }

    try {
        // Get current blacklist and managed list
        const [currentBlacklist, currentList] = await Promise.all([
            getBlacklistedTokenIds(),
            getManagedTokenIds()
        ]);

        // Add to blacklist if not already present
        if (!currentBlacklist.includes(contractId)) {
            const newBlacklist = [...currentBlacklist, contractId];
            await kv.set(BLACKLIST_KEY, newBlacklist);
            console.log(`Added ${contractId} to blacklist`);
        }

        // Remove from managed list if present
        if (currentList.includes(contractId)) {
            const newList = currentList.filter(id => id !== contractId);
            await kv.set(TOKEN_LIST_KEY, newList);
            console.log(`Removed ${contractId} from managed list`);
        }

        // Remove cached data
        const cacheKey = getCacheKey(contractId);
        await kv.del(cacheKey);
        console.log(`Removed cached data for ${contractId}`);

        return { success: true, message: `Successfully blacklisted ${contractId}` };
    } catch (error) {
        console.error(`Failed to blacklist ${contractId}:`, error);
        return { success: false, message: `Failed to blacklist token: ${error}` };
    }
};

/**
 * Removes a contract ID from the blacklist.
 * @param contractId - The contract ID to remove from blacklist.
 * @returns Success status and message.
 */
export const removeFromBlacklist = async (contractId: string): Promise<{ success: boolean; message: string }> => {
    if (!contractId) {
        return { success: false, message: 'Contract ID is required' };
    }

    try {
        const currentBlacklist = await getBlacklistedTokenIds();

        if (!currentBlacklist.includes(contractId)) {
            return { success: false, message: 'Token not found in blacklist' };
        }

        const newBlacklist = currentBlacklist.filter(id => id !== contractId);
        await kv.set(BLACKLIST_KEY, newBlacklist);
        console.log(`Removed ${contractId} from blacklist`);

        return { success: true, message: `Successfully removed ${contractId} from blacklist` };
    } catch (error) {
        console.error(`Failed to remove ${contractId} from blacklist:`, error);
        return { success: false, message: `Failed to remove from blacklist: ${error}` };
    }
};

/**
 * Checks if a contract ID is blacklisted.
 * @param contractId - The contract ID to check.
 * @returns True if blacklisted, false otherwise.
 */
export const isBlacklisted = async (contractId: string): Promise<boolean> => {
    try {
        const blacklistedIds = await getBlacklistedTokenIds();
        return blacklistedIds.includes(contractId);
    } catch (error) {
        console.error(`Error checking blacklist status for ${contractId}:`, error);
        return false; // Default to not blacklisted on error
    }
};

/**
 * Generates the cache key for a given contract ID.
 * @param contractId - The token contract ID.
 * @returns The cache key string.
 * @throws Error if contractId is invalid
 */
export const getCacheKey = (contractId: string): string => {
    if (!contractId || typeof contractId !== 'string') {
        throw new Error(`Invalid contractId for cache key: ${contractId}`);
    }
    
    // Basic format validation - should contain a dot
    if (!contractId.includes('.')) {
        throw new Error(`Invalid contractId format (expected address.contract): ${contractId}`);
    }
    
    // Handle special case for STX
    if (contractId === '.stx') {
        return 'sip10:stx';
    }
    
    return `sip10:${contractId}`;
};

/**
 * Adds a contract ID to the managed token list in KV if it's not already present and not blacklisted.
 * @param contractId - The contract ID to add.
 */
export const addContractIdToManagedList = async (contractId: string): Promise<void> => { // <-- EXPORT
    if (!contractId) return;

    // Check if token is blacklisted before adding
    if (await isBlacklisted(contractId)) {
        console.log(`Skipping ${contractId} - token is blacklisted`);
        return;
    }

    try {
        const currentList = await getManagedTokenIds();
        if (!currentList.includes(contractId)) {
            const newList = [...currentList, contractId];
            await kv.set(TOKEN_LIST_KEY, newList);
            console.log(`Added ${contractId} to the managed token list.`);
        }
    } catch (error) {
        console.error(`Failed to add ${contractId} to the managed token list:`, error);
        // Decide if failure here should prevent token data return (likely not)
    }
};

/**
 * Fetches token data for a single contract ID, utilizing Vercel KV cache.
 * Allows forcing a refresh to bypass the cache.
 *
 * @param contractId - The contract ID of the token.
 * @param forceRefresh - If true, bypasses the cache check and fetches fresh data.
 * @returns A promise resolving to the TokenMetadata or null if not found/error.
 */
export const getTokenData = async (contractId: string, forceRefresh: boolean = false): Promise<TokenCacheData | null> => {
    if (!contractId) {
        console.error("getTokenData called with empty contractId");
        return null;
    }

    // Check if token is blacklisted
    if (await isBlacklisted(contractId)) {
        console.log(`Token ${contractId} is blacklisted, returning null`);
        return null;
    }

    let cacheKey: string;
    try {
        cacheKey = getCacheKey(contractId);
    } catch (error) {
        console.error(`Failed to generate cache key for ${contractId}:`, error);
        return null;
    }

    try {
        // 1. Check cache first (unless forcing refresh)
        let cachedData: TokenCacheData | null = null;
        if (!forceRefresh) {
            cachedData = await kv.get<TokenCacheData>(cacheKey);
            if (cachedData) {
                if (!cachedData.contractId) {
                    cachedData.contractId = contractId;
                    await kv.set(cacheKey, cachedData, { ex: CACHE_DURATION_SECONDS });
                }
                return cachedData;
            }
            console.log(`Cache miss for ${contractId}, fetching from source.`);
        } else {
            // If forceRefresh, still get the cached data as baseline
            cachedData = await kv.get<TokenCacheData>(cacheKey);
            console.log(`Force refresh requested for ${contractId}, fetching from source.`);
        }

        const tokenMetadata = await cryptonomicon.getTokenMetadata(contractId);

        let mergedData: TokenCacheData | null = null;
        if (tokenMetadata) {
            if (!tokenMetadata.contractId) tokenMetadata.contractId = contractId;

            if (cachedData) {
                mergedData = { ...cachedData };
                for (const key of Object.keys(tokenMetadata)) {
                    const value = tokenMetadata[key as keyof TokenCacheData];
                    if (value !== undefined) {
                        (mergedData as any)[key] = value;
                    }
                }
            } else {
                mergedData = tokenMetadata;
            }

            await kv.set(cacheKey, mergedData, { ex: CACHE_DURATION_SECONDS });
            return mergedData;
        } else {
            console.warn(`Failed to fetch metadata for ${contractId}`);
            return cachedData;
        }
    } catch (error) {
        console.error(`Error fetching or caching data for ${contractId}:`, error);
        try {
            const cachedData = await kv.get<TokenCacheData>(cacheKey);
            if (cachedData) {
                console.warn(`Returning stale cache for ${contractId} due to error.`);
                if (!cachedData.contractId) cachedData.contractId = contractId;
                return cachedData;
            }
        } catch (cacheError) {
            console.error(`Error retrieving cache during error handling for ${contractId}:`, cacheError);
        }
        return null;
    }
};

/**
 * Fetches token data for all MANAGED token IDs stored in Vercel KV, excluding blacklisted tokens.
 *
 * @returns A promise resolving to an array of TokenMetadata objects.
 */
export const getAllMetadata = async (): Promise<TokenCacheData[]> => {
    // 1. Fetch the list of managed token IDs from KV
    const [managedTokenIds, blacklistedIds] = await Promise.all([
        getManagedTokenIds(),
        getBlacklistedTokenIds()
    ]);

    // 2. Filter out blacklisted tokens
    const validTokenIds = managedTokenIds.filter(id => !blacklistedIds.includes(id));

    if (validTokenIds.length === 0) {
        console.log("No valid (non-blacklisted) token IDs found in KV.");
        return [];
    }

    console.log(`Processing ${validTokenIds.length} tokens (${managedTokenIds.length - validTokenIds.length} blacklisted)`);

    let cacheHitCount = 0;
    const allDataPromises = validTokenIds.map(id => {
        return kv.get(getCacheKey(id)).then(cached => {
            if (cached) cacheHitCount++;
            return getTokenData(id); // Now call the actual function
        }).catch(error => {
            console.error(`[getAllMetadata] Error processing token ${id}:`, error);
            return null; // Return null for failed tokens
        });
    });
    const allDataResults = await Promise.allSettled(allDataPromises);

    const successfulData = allDataResults
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map((result: any, index) => {
            const tokenData = result.value;
            if (!tokenData.contractId) tokenData.contractId = validTokenIds[index]

            return tokenData;
        });

    // Log any failures
    allDataResults.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`Failed to get data for ${validTokenIds[index]}:`, result.reason);
        } else if (result.value === null && result.status === 'fulfilled') {
            console.warn(`No data found for ${validTokenIds[index]} (returned null).`);
        }
    });

    console.log(`[getAllMetadata] Processed ${validTokenIds.length} tokens. Cache hits: ${cacheHitCount}. Fetched/Failed: ${validTokenIds.length - cacheHitCount}.`);
    return successfulData;
};

/**
 * Fetches cache statistics including blacklist information.
 * @returns A promise resolving to an object with totalManaged, cachedCount, and blacklist stats.
 */
export const getCacheStats = async (): Promise<{
    totalManaged: number;
    blacklistedCount: number;
    activeTokens: number;
    cachedCount: number;
    apiHits: number;
    apiMisses: number;
    averageCacheAgeMs: number | null;
    minCacheAgeMs: number | null;
    maxCacheAgeMs: number | null;
}> => {
    let totalManaged = 0;
    let blacklistedCount = 0;
    let cachedCount = 0;
    let apiHits = 0;
    let apiMisses = 0;
    let totalAgeMs = 0;
    let minAgeMs: number | null = null;
    let maxAgeMs: number | null = null;
    let validAgeCount = 0;

    try {
        // Fetch managed list, blacklist, and API hit/miss counts concurrently
        const [managedTokenIds, blacklistedIds, hits, misses] = await Promise.all([
            getManagedTokenIds(),
            getBlacklistedTokenIds(),
            kv.get<number>('stats:api:hits').catch(() => 0),     // Default to 0 on error
            kv.get<number>('stats:api:misses').catch(() => 0)   // Default to 0 on error
        ]);

        totalManaged = managedTokenIds.length;
        blacklistedCount = blacklistedIds.length;
        const activeTokens = totalManaged - managedTokenIds.filter(id => blacklistedIds.includes(id)).length;
        apiHits = hits || 0;
        apiMisses = misses || 0;

        if (activeTokens > 0) {
            // Check cache status and get data for active tokens only
            const activeTokenIds = managedTokenIds.filter(id => !blacklistedIds.includes(id));
            const cacheKeys = activeTokenIds.map(id => getCacheKey(id));
            const cachedItems = await kv.mget<any[]>(...cacheKeys);

            const now = Date.now();
            cachedItems.forEach(item => {
                if (item !== null) {
                    cachedCount++;
                    if (typeof item.lastRefreshed === 'number') {
                        const ageMs = now - item.lastRefreshed;
                        totalAgeMs += ageMs;
                        if (minAgeMs === null || ageMs < minAgeMs) {
                            minAgeMs = ageMs;
                        }
                        if (maxAgeMs === null || ageMs > maxAgeMs) {
                            maxAgeMs = ageMs;
                        }
                        validAgeCount++;
                    }
                }
            });
        }

        const averageCacheAgeMs = validAgeCount > 0 ? totalAgeMs / validAgeCount : null;

        return {
            totalManaged,
            blacklistedCount,
            activeTokens,
            cachedCount,
            apiHits,
            apiMisses,
            averageCacheAgeMs,
            minCacheAgeMs: minAgeMs,
            maxCacheAgeMs: maxAgeMs,
        };
    } catch (error) {
        console.error("Error fetching cache stats:", error);
        // Return 0/null counts on error
        return {
            totalManaged: 0,
            blacklistedCount: 0,
            activeTokens: 0,
            cachedCount: 0,
            apiHits: 0,
            apiMisses: 0,
            averageCacheAgeMs: null,
            minCacheAgeMs: null,
            maxCacheAgeMs: null,
        };
    }
}; 