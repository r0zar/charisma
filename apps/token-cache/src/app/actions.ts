'use server';

import { kv } from "@vercel/kv";
import { revalidatePath } from 'next/cache';
import { getTokenData } from "@/lib/tokenService";

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