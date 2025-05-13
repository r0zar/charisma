import { Cryptonomicon, TokenMetadata } from "@repo/cryptonomicon";
import { kv } from "@vercel/kv";

// Initialize Cryptonomicon (adjust config as needed)
const cryptonomicon = new Cryptonomicon({
    debug: true,
    apiKey: process.env.HIRO_API_KEY,
});

// Define the cache duration (30 days in seconds)
const CACHE_DURATION_SECONDS = 30 * 24 * 60 * 60;
export const TOKEN_LIST_KEY = "token-list:sip10";

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
 * Generates the cache key for a given contract ID.
 * @param contractId - The token contract ID.
 * @returns The cache key string.
 */
export const getCacheKey = (contractId: string): string => `sip10:${contractId}`;

/**
 * Adds a contract ID to the managed token list in KV if it's not already present.
 * @param contractId - The contract ID to add.
 */
export const addContractIdToManagedList = async (contractId: string): Promise<void> => { // <-- EXPORT
    if (!contractId) return;

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
export const getTokenData = async (
    contractId: string,
    forceRefresh: boolean = false
): Promise<TokenMetadata | null> => {
    if (!contractId) {
        console.error("getTokenData called with empty contractId");
        return null;
    }

    const cacheKey = getCacheKey(contractId);

    try {
        // 1. Check cache first (unless forcing refresh)
        let cachedData: TokenMetadata | null = null;
        if (!forceRefresh) {
            cachedData = await kv.get<TokenMetadata>(cacheKey);
            if (cachedData) {
                // console.log(`Cache hit for ${contractId}`);

                // Ensure contract_principal is set even for cached data
                if (!cachedData.contract_principal) {
                    cachedData.contract_principal = contractId;
                    // Also update the refresh timestamp when fixing cached data
                    cachedData.lastRefreshed = Date.now();
                    // Update the cache with the fixed data
                    await kv.set(cacheKey, cachedData, { ex: CACHE_DURATION_SECONDS });
                    console.log(`Updated cached data for ${contractId} with contract_principal`);
                }

                return cachedData;
            }
            console.log(`Cache miss for ${contractId}, fetching from source.`);
        } else {
            // If forceRefresh, still get the cached data as baseline
            cachedData = await kv.get<TokenMetadata>(cacheKey);
            console.log(`Force refresh requested for ${contractId}, fetching from source.`);
        }

        // 2. Fetch from Cryptonomicon
        const tokenMetadata = await cryptonomicon.getTokenMetadata(contractId);
        console.log(`Token metadata: ${JSON.stringify(tokenMetadata)}`);

        let mergedData: TokenMetadata | null = null;
        if (tokenMetadata) {
            // Ensure contract_principal is set
            if (!tokenMetadata.contract_principal) {
                tokenMetadata.contract_principal = contractId;
            }

            // Add the last refreshed timestamp before caching
            tokenMetadata.lastRefreshed = Date.now();

            // Merge: use cachedData as baseline, only overwrite with defined fields from tokenMetadata
            if (cachedData) {
                mergedData = { ...cachedData };
                for (const key of Object.keys(tokenMetadata)) {
                    const value = (tokenMetadata as any)[key];
                    if (value !== undefined) {
                        (mergedData as any)[key] = value;
                    }
                }
            } else {
                mergedData = tokenMetadata;
            }

            // 3. Cache the merged data
            await kv.set(cacheKey, mergedData, { ex: CACHE_DURATION_SECONDS });
            console.log(`Cached data for ${contractId}`);

            return mergedData;
        } else {
            console.warn(`Failed to fetch metadata for ${contractId}`);
            return cachedData; // Return cached data if available, else null
        }
    } catch (error) {
        console.error(`Error fetching or caching data for ${contractId}:`, error);
        // Attempt to return cached data even if there was an error during fetch/set
        try {
            const cachedData = await kv.get<TokenMetadata>(cacheKey);
            if (cachedData) {
                console.warn(`Returning stale cache for ${contractId} due to error.`);

                // Ensure contract_principal is set even for cached data in error case
                if (!cachedData.contract_principal) {
                    cachedData.contract_principal = contractId;
                }

                return cachedData;
            }
        } catch (cacheError) {
            console.error(`Error retrieving cache during error handling for ${contractId}:`, cacheError);
        }
        return null;
    }
};

/**
 * Fetches token data for all MANAGED token IDs stored in Vercel KV.
 *
 * @returns A promise resolving to an array of TokenMetadata objects.
 */
export const getAllTokenData = async (): Promise<TokenMetadata[]> => {
    // 1. Fetch the list of managed token IDs from KV
    const managedTokenIds = await getManagedTokenIds();

    if (managedTokenIds.length === 0) {
        console.log("No managed token IDs found in KV.");
        return [];
    }

    let cacheHitCount = 0;
    // 2. Fetch data for each ID (this uses the existing getTokenData with its caching)
    const allDataPromises = managedTokenIds.map(id => {
        // We need to know if getTokenData hit the cache or not.
        // Modify getTokenData slightly to return this info, or infer it here.
        // Inferring: Check KV directly before calling getTokenData.
        // This adds extra reads but avoids modifying getTokenData return signature.
        return kv.get<TokenMetadata>(getCacheKey(id)).then(cached => {
            if (cached) cacheHitCount++;
            return getTokenData(id); // Now call the actual function
        });
    });
    const allDataResults = await Promise.allSettled(allDataPromises);

    const successfulData = allDataResults
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map((result, index) => {
            const tokenData = (result as PromiseFulfilledResult<TokenMetadata>).value;
            // Double-check that contract_principal is set for every token
            if (!tokenData.contract_principal) {
                tokenData.contract_principal = managedTokenIds[index];
                console.log(`Fixed missing contract_principal for ${managedTokenIds[index]} in getAllTokenData`);
            }
            return tokenData;
        });

    // Log any failures
    allDataResults.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`Failed to get data for ${managedTokenIds[index]}:`, result.reason);
        } else if (result.value === null && result.status === 'fulfilled') {
            console.warn(`No data found for ${managedTokenIds[index]} (returned null).`);
        }
    });

    console.log(`[getAllTokenData] Processed ${managedTokenIds.length} tokens. Cache hits: ${cacheHitCount}. Fetched/Failed: ${managedTokenIds.length - cacheHitCount}.`);
    return successfulData;
};

/**
 * Fetches cache statistics.
 * @returns A promise resolving to an object with totalManaged and cachedCount.
 */
export const getCacheStats = async (): Promise<{
    totalManaged: number;
    cachedCount: number;
    apiHits: number;
    apiMisses: number;
    averageCacheAgeMs: number | null;
    minCacheAgeMs: number | null;
    maxCacheAgeMs: number | null;
}> => {
    let totalManaged = 0;
    let cachedCount = 0;
    let apiHits = 0;
    let apiMisses = 0;
    let totalAgeMs = 0;
    let minAgeMs: number | null = null;
    let maxAgeMs: number | null = null;
    let validAgeCount = 0;

    try {
        // Fetch managed list and API hit/miss counts concurrently
        const [managedTokenIds, hits, misses] = await Promise.all([
            getManagedTokenIds(),
            kv.get<number>('stats:api:hits').catch(() => 0),     // Default to 0 on error
            kv.get<number>('stats:api:misses').catch(() => 0)   // Default to 0 on error
        ]);

        totalManaged = managedTokenIds.length;
        apiHits = hits || 0;
        apiMisses = misses || 0;

        if (totalManaged > 0) {
            // Check cache status and get data for each managed ID
            // Use kv.mget to fetch multiple keys efficiently
            const cacheKeys = managedTokenIds.map(id => getCacheKey(id));
            const cachedItems = await kv.mget<TokenMetadata[]>(...cacheKeys);

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
            cachedCount: 0,
            apiHits: 0,
            apiMisses: 0,
            averageCacheAgeMs: null,
            minCacheAgeMs: null,
            maxCacheAgeMs: null,
        };
    }
}; 