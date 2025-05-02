'use server';

import { kv } from "@vercel/kv";
import { revalidatePath } from 'next/cache';
import { getTokenData } from "@/lib/tokenService";
import { Cryptonomicon, TokenMetadata } from "@repo/cryptonomicon";
import { getCacheKey } from "@/lib/tokenService";

const TOKEN_LIST_KEY = "token-list:sip10";

/**
 * Fetches the list of managed token contract IDs from Vercel KV.
 * (Copied from tokenService for use within the action - alternatively, export it from tokenService)
 * @returns A promise resolving to an array of contract ID strings.
 */
const getManagedTokenIds = async (): Promise<string[]> => {
    try {
        const tokenIds = await kv.get<string[]>(TOKEN_LIST_KEY);
        return Array.isArray(tokenIds) ? tokenIds : [];
    } catch (error) {
        console.error(`Error fetching token list from KV (${TOKEN_LIST_KEY}):`, error);
        return [];
    }
};

/**
 * Server Action to remove a token contract ID from the managed list in KV.
 * **Only works in development mode.**
 * @param contractId The contract ID to remove.
 */
export async function removeTokenFromList(contractId: string) {
    // Strict check for development environment
    if (process.env.NODE_ENV !== 'development') {
        return { success: false, error: 'This action is only available in development mode.' };
    }

    if (!contractId) {
        return { success: false, error: 'Contract ID is required.' };
    }

    try {
        console.log(`Attempting to remove ${contractId} (DEV MODE)...`);
        const currentList = await getManagedTokenIds();

        if (!currentList.includes(contractId)) {
            return { success: false, error: 'Token not found in the list.' };
        }

        const newList = currentList.filter(id => id !== contractId);
        await kv.set(TOKEN_LIST_KEY, newList);

        console.log(`Successfully removed ${contractId} from list.`);
        // Revalidate the home page path to try and reflect the change
        revalidatePath('/');
        return { success: true };

    } catch (error: any) {
        console.error(`Failed to remove ${contractId} from list:`, error);
        return { success: false, error: error.message || 'Failed to update list in KV.' };
    }
}

/**
 * Server Action to force refresh a specific token's data.
 * Calls getTokenData with forceRefresh = true.
 * @param contractId The contract ID to refresh.
 */
export async function refreshTokenData(contractId: string) {
    if (!contractId) {
        return { success: false, error: 'Contract ID is required.' };
    }
    console.log(`Attempting to force refresh data for ${contractId}...`);
    try {
        // Call getTokenData with forceRefresh set to true
        const freshData = await getTokenData(contractId, true);

        if (!freshData) {
            // This implies the lookup failed even on a forced refresh
            return { success: false, error: 'Failed to fetch fresh data (token might not exist).' };
        }

        // Data was fetched and cache was updated by getTokenData
        console.log(`Successfully refreshed data for ${contractId}.`);

        // Revalidate the home page path to try and reflect the change
        revalidatePath('/');
        return { success: true, message: `Refreshed data for ${freshData.symbol || contractId}.` };

    } catch (error: any) {
        console.error(`Failed to refresh data for ${contractId}:`, error);
        return { success: false, error: error.message || 'Failed to refresh data.' };
    }
}

// Initialize Cryptonomicon directly for inspection purposes
// Ensure configuration matches the one in tokenService if necessary
const cryptonomicon = new Cryptonomicon({
    debug: process.env.NODE_ENV === 'development',
    network: process.env.NEXT_PUBLIC_NETWORK === 'testnet' ? 'testnet' : 'mainnet',
    apiKey: process.env.HIRO_API_KEY,
});

interface InspectionResult {
    contractId: string;
    rawMetadata?: TokenMetadata | null; // Raw data fetched directly
    cachedData?: TokenMetadata | null; // Current data in cache
    fetchError?: string | null; // Error during the direct fetch
    cacheError?: string | null; // Error fetching cached data
}

/**
 * Fetches both raw and cached token metadata for inspection.
 */
export async function inspectTokenData(contractId: string): Promise<InspectionResult> {
    if (!contractId || !contractId.includes('.')) {
        return { contractId, fetchError: 'Invalid contract ID format.' };
    }

    const cacheKey = getCacheKey(contractId);
    let rawMetadata: TokenMetadata | null = null;
    let cachedData: TokenMetadata | null = null;
    let fetchError: string | null = null;
    let cacheError: string | null = null;

    console.log(`[Inspect] Inspecting token: ${contractId}`);

    // Attempt to fetch raw data directly
    try {
        console.log(`[Inspect] Fetching raw metadata for ${contractId} via Cryptonomicon...`);
        rawMetadata = await cryptonomicon.getTokenMetadata(contractId);
        console.log(`[Inspect] Raw metadata fetched for ${contractId}:`, rawMetadata ? 'Data found' : 'Not found');
    } catch (error: any) {
        console.error(`[Inspect] Error fetching raw metadata for ${contractId}:`, error);
        fetchError = error.message || 'Failed to fetch raw metadata.';
    }

    // Attempt to fetch cached data
    try {
        console.log(`[Inspect] Fetching cached data for ${contractId} from key: ${cacheKey}`);
        cachedData = await kv.get<TokenMetadata>(cacheKey);
        console.log(`[Inspect] Cached data fetched for ${contractId}:`, cachedData ? 'Data found' : 'Not found');
    } catch (error: any) {
        console.error(`[Inspect] Error fetching cached data for ${contractId}:`, error);
        cacheError = error.message || 'Failed to fetch cached data.';
    }

    return {
        contractId,
        rawMetadata,
        cachedData,
        fetchError,
        cacheError,
    };
}

/**
 * Forces a refresh of the token data in the cache using the existing service function.
 */
export async function forceRefreshToken(contractId: string): Promise<{ success: boolean; data?: TokenMetadata | null; error?: string }> {
    if (!contractId || !contractId.includes('.')) {
        return { success: false, error: 'Invalid contract ID format.' };
    }
    console.log(`[Inspect] Forcing refresh for token: ${contractId}`);
    try {
        // Use the existing getTokenData function from the service with forceRefresh=true
        const refreshedData = await getTokenData(contractId, true);
        if (refreshedData) {
            console.log(`[Inspect] Refresh successful for ${contractId}`);
            return { success: true, data: refreshedData };
        } else {
            console.warn(`[Inspect] Refresh for ${contractId} completed but returned null data.`);
            return { success: false, error: 'Refresh completed but no data was returned.' };
        }
    } catch (error: any) {
        console.error(`[Inspect] Error during forced refresh for ${contractId}:`, error);
        return { success: false, error: error.message || 'Failed to force refresh token data.' };
    }
} 