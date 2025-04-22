import { Cryptonomicon, TokenMetadata } from "@repo/cryptonomicon";
import { kv } from "@vercel/kv";

// Initialize Cryptonomicon (adjust config as needed)
const cryptonomicon = new Cryptonomicon({
    network: process.env.NEXT_PUBLIC_NETWORK === 'testnet' ? 'testnet' : 'mainnet',
    // Add any other specific configurations for Cryptonomicon here
    // e.g., apiKeys, proxy, etc.
});

// Define the cache duration (30 days in seconds)
const CACHE_DURATION_SECONDS = 30 * 24 * 60 * 60;
export const TOKEN_LIST_KEY = "token-list:sip10"; // <-- EXPORT

// --- REMOVED Hardcoded list ---
// const HARDCODED_TOKEN_IDS = [...];
// --- ---

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
const getCacheKey = (contractId: string): string => `sip10:${contractId}`;

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
    forceRefresh: boolean = false // <-- Add forceRefresh parameter
): Promise<TokenMetadata | null> => {
    if (!contractId) {
        console.error("getTokenData called with empty contractId");
        return null;
    }

    const cacheKey = getCacheKey(contractId);

    try {
        // 1. Check cache first (unless forcing refresh)
        if (!forceRefresh) { // <-- Check forceRefresh flag
            const cachedData = await kv.get<TokenMetadata>(cacheKey);
            if (cachedData) {
                console.log(`Cache hit for ${contractId}`);
                return cachedData;
            }
            console.log(`Cache miss for ${contractId}, fetching from source.`);
        } else {
            console.log(`Force refresh requested for ${contractId}, fetching from source.`);
        }

        // 2. Fetch from Cryptonomicon
        const tokenMetadata = await cryptonomicon.getTokenMetadata(contractId);

        if (tokenMetadata) {
            // 3. Cache the fetched data
            await kv.set(cacheKey, tokenMetadata, { ex: CACHE_DURATION_SECONDS });
            console.log(`Cached data for ${contractId}`);

            return tokenMetadata;
        } else {
            console.warn(`Failed to fetch metadata for ${contractId}`);
            // Optional: Cache a 'not found' state for a shorter duration?
            // await kv.set(cacheKey, { notFound: true }, { ex: 60 * 60 }); // Cache 'not found' for 1 hour
            return null;
        }
    } catch (error) {
        console.error(`Error fetching or caching data for ${contractId}:`, error);
        // Attempt to return cached data even if there was an error during fetch/set
        try {
            const cachedData = await kv.get<TokenMetadata>(cacheKey);
            if (cachedData) {
                console.warn(`Returning stale cache for ${contractId} due to error.`);
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

    // 2. Fetch data for each ID (this uses the existing getTokenData with its caching)
    const allDataPromises = managedTokenIds.map(id => getTokenData(id));
    const allDataResults = await Promise.allSettled(allDataPromises);

    const successfulData = allDataResults
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => (result as PromiseFulfilledResult<TokenMetadata>).value);

    // Log any failures
    allDataResults.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`Failed to get data for ${managedTokenIds[index]}:`, result.reason);
        } else if (result.value === null && result.status === 'fulfilled') {
            console.warn(`No data found for ${managedTokenIds[index]} (returned null).`);
        }
    });

    return successfulData;
}; 