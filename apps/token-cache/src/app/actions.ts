'use server';

import { kv } from "@vercel/kv";
import { revalidatePath } from 'next/cache';
import { addContractIdToManagedList, getTokenData, addToBlacklist, removeFromBlacklist, getBlacklistedTokenIds, isBlacklisted } from "@/lib/tokenService";
import { Cryptonomicon } from "../lib/cryptonomicon";
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
 * Server Action to add a token to the blacklist.
 * This removes it from the managed list and prevents re-indexing.
 * **Only works in development mode.**
 * @param contractId The contract ID to blacklist.
 */
export async function blacklistToken(contractId: string) {
    // Strict check for development environment
    if (process.env.NODE_ENV !== 'development') {
        return { success: false, error: 'This action is only available in development mode.' };
    }

    if (!contractId) {
        return { success: false, error: 'Contract ID is required.' };
    }

    try {
        console.log(`Attempting to blacklist ${contractId} (DEV MODE)...`);
        const result = await addToBlacklist(contractId);

        if (result.success) {
            // Revalidate paths to reflect the change
            revalidatePath('/');
            revalidatePath('/admin');
            revalidatePath('/tokens');
        }

        return result;
    } catch (error: any) {
        console.error(`Failed to blacklist ${contractId}:`, error);
        return { success: false, error: error.message || 'Failed to blacklist token.' };
    }
}

/**
 * Server Action to remove a token from the blacklist.
 * **Only works in development mode.**
 * @param contractId The contract ID to unblacklist.
 */
export async function unblacklistToken(contractId: string) {
    // Strict check for development environment
    if (process.env.NODE_ENV !== 'development') {
        return { success: false, error: 'This action is only available in development mode.' };
    }

    if (!contractId) {
        return { success: false, error: 'Contract ID is required.' };
    }

    try {
        console.log(`Attempting to unblacklist ${contractId} (DEV MODE)...`);
        const result = await removeFromBlacklist(contractId);

        if (result.success) {
            // Revalidate paths to reflect the change
            revalidatePath('/');
            revalidatePath('/admin');
            revalidatePath('/tokens');
        }

        return result;
    } catch (error: any) {
        console.error(`Failed to unblacklist ${contractId}:`, error);
        return { success: false, error: error.message || 'Failed to unblacklist token.' };
    }
}

/**
 * Server Action to get all blacklisted tokens.
 * @returns Array of blacklisted contract IDs.
 */
export async function getBlacklistedTokens() {
    try {
        const blacklistedIds = await getBlacklistedTokenIds();
        return { success: true, data: blacklistedIds };
    } catch (error: any) {
        console.error('Failed to fetch blacklisted tokens:', error);
        return { success: false, error: error.message || 'Failed to fetch blacklisted tokens.', data: [] };
    }
}

/**
 * Server Action to check if a token is blacklisted.
 * @param contractId The contract ID to check.
 * @returns Boolean indicating if token is blacklisted.
 */
export async function checkTokenBlacklisted(contractId: string) {
    if (!contractId) {
        return { success: false, error: 'Contract ID is required.', isBlacklisted: false };
    }

    try {
        const blacklisted = await isBlacklisted(contractId);
        return { success: true, isBlacklisted: blacklisted };
    } catch (error: any) {
        console.error(`Failed to check blacklist status for ${contractId}:`, error);
        return { success: false, error: error.message || 'Failed to check blacklist status.', isBlacklisted: false };
    }
}

/**
 * Server Action to add a token contract ID to the managed list in KV.
 * **Only works in development mode.**
 * @param contractId The contract ID to add.
 */
export async function addTokenToList(contractId: string) {
    addContractIdToManagedList(contractId);
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

    // Check if token is blacklisted before refreshing
    if (await isBlacklisted(contractId)) {
        return { success: false, error: 'Cannot refresh blacklisted token. Remove from blacklist first.' };
    }

    console.log(`Attempting to force refresh data for ${contractId}...`);
    try {
        // Call getTokenData with forceRefresh set to true
        const freshData = await getTokenData(contractId, true);

        if (!freshData) {
            // This implies the lookup failed even on a forced refresh
            return { success: false, error: 'Failed to fetch fresh data (token might not exist).' };
        }

        // Attempt to add the token to the list after successful refresh
        await addTokenToList(contractId);

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

const cryptonomicon = new Cryptonomicon({
    debug: process.env.NODE_ENV === 'development',
    apiKey: process.env.HIRO_API_KEY,
});

interface InspectionResult {
    contractId: string;
    rawMetadata?: any | null; // Raw data fetched directly
    cachedData?: any | null; // Current data in cache
    fetchError?: string | null; // Error during the direct fetch
    cacheError?: string | null; // Error fetching cached data
    isBlacklisted?: boolean; // Whether token is blacklisted
}

/**
 * Fetches both raw and cached token metadata for inspection.
 */
export async function inspectTokenData(contractId: string): Promise<InspectionResult> {
    if (!contractId || !contractId.includes('.')) {
        return { contractId, fetchError: 'Invalid contract ID format.' };
    }

    // Check if token is blacklisted
    const blacklisted = await isBlacklisted(contractId);

    // Note: Inspection should NOT automatically add tokens to managed list
    // This separation allows pure inspection without side effects

    let cacheKey: string;
    try {
        cacheKey = getCacheKey(contractId);
    } catch (error: any) {
        console.error(`[Inspect] Invalid contractId format for ${contractId}:`, error);
        return { contractId, fetchError: `Invalid contract ID format: ${error.message}` };
    }
    let rawMetadata: any | null = null;
    let cachedData: any | null = null;
    let fetchError: string | null = null;
    let cacheError: string | null = null;

    console.log(`[Inspect] Inspecting token: ${contractId} (blacklisted: ${blacklisted})`);

    // Attempt to fetch raw data directly
    try {
        console.log(`[Inspect] Fetching raw metadata for ${contractId}...`);
        rawMetadata = await cryptonomicon.getTokenMetadata(contractId);
        console.log(`[Inspect] Raw metadata fetched for ${contractId}:`, rawMetadata ? 'Data found' : 'Not found');
    } catch (error: any) {
        console.error(`[Inspect] Error fetching raw metadata for ${contractId}:`, error);
        fetchError = error.message || 'Failed to fetch raw metadata.';
    }

    // Attempt to fetch cached data
    try {
        console.log(`[Inspect] Fetching cached data for ${contractId} from key: ${cacheKey}`);
        cachedData = await kv.get<any>(cacheKey);
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
        isBlacklisted: blacklisted,
    };
}

/**
 * Forces a refresh of the token data in the cache using the existing service function.
 */
export async function forceRefreshToken(contractId: string): Promise<{ success: boolean; data?: any | null; error?: string }> {
    if (!contractId || !contractId.includes('.')) {
        return { success: false, error: 'Invalid contract ID format.' };
    }

    // Check if token is blacklisted before refreshing
    if (await isBlacklisted(contractId)) {
        return { success: false, error: 'Cannot refresh blacklisted token. Remove from blacklist first.' };
    }

    console.log(`[Inspect] Forcing refresh for token: ${contractId}`);
    try {
        // Use the existing getTokenData function from the service with forceRefresh=true
        const refreshedData = await getTokenData(contractId, true);
        if (refreshedData) {
            console.log(`[Inspect] Refresh successful for ${contractId}`);
            // Note: Force refresh during inspection should NOT automatically add to managed list
            // Use explicit addTokenToList action if needed
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

export async function updateCachedTokenData(contractId: string, newData: any): Promise<{ success: boolean, error?: string }> {
    if (!contractId || typeof contractId !== 'string') {
        return { success: false, error: 'Invalid Contract ID provided.' };
    }

    if (newData === undefined || newData === null) {
        return { success: false, error: 'Invalid data provided for update.' };
    }

    // Check if token is blacklisted before updating
    if (await isBlacklisted(contractId)) {
        return { success: false, error: 'Cannot update blacklisted token. Remove from blacklist first.' };
    }

    const cacheKey = getCacheKey(contractId);

    try {
        // Validate if newData is actually valid JSON (it should be an object/array from react-json-view)
        // Although react-json-view passes an object, let's ensure it's structurally sound if needed,
        // basic check here assumes react-json-view provides valid structure.
        if (typeof newData !== 'object') {
            throw new Error('Data must be a valid JSON object or array.');
        }

        // Get existing cached data first
        const existingData = await kv.get<any>(cacheKey);

        // Merge the new data with existing data, with new data taking precedence
        const mergedData = existingData ? { ...existingData, ...newData } : newData;

        await kv.set(cacheKey, mergedData);
        console.log(`Cache updated successfully for ${contractId}`);
        return { success: true };
    } catch (error: any) {
        console.error(`Error updating cache for ${contractId}:`, error);
        return { success: false, error: error.message || 'Failed to update cache in Vercel KV.' };
    }
}