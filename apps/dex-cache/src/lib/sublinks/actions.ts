'use server';

import { revalidatePath } from 'next/cache';
import { FetchedSublinkDetails } from '@/components/sublink/AddSublinkDialog'; // Assuming this type is exported and suitable
import { VAULT_CACHE_KEY_PREFIX } from '../pool-service';
import { kv } from '@vercel/kv';

// Placeholder for your actual data storage mechanism
// In a real app, this would interact with a database, KV store, or an API.
async function saveSublinkToDatabase(sublinkData: FetchedSublinkDetails) {
    try {
        // Simulate database save
        console.log("Attempting to save sublink to database:", JSON.stringify(sublinkData, null, 2));

        const cacheKey = `${VAULT_CACHE_KEY_PREFIX}${sublinkData.contractId}`;
        const cachedVault = await kv.set(cacheKey, sublinkData);

        console.log("Sublink saved successfully.");
        return { success: true, message: "Sublink created and saved successfully!", cachedVault };
    } catch (error: any) {
        console.error("Error saving sublink to database:", error);
        return { success: false, error: error.message || "An unexpected error occurred while saving the sublink." };
    }
}

export async function createNewSublinkAction(sublinkData: FetchedSublinkDetails): Promise<{ success: boolean; message?: string; error?: string }> {
    console.log("Server Action: createNewSublinkAction called with:", sublinkData);

    // Basic server-side validation (can be more extensive)
    if (!sublinkData || !sublinkData.contractId || !sublinkData.tokenAContract || !sublinkData.tokenBContract || !sublinkData.tokenB?.base) {
        console.error("Server Action Validation Failed: Missing critical contract IDs.");
        return { success: false, error: "Validation failed on server: Critical contract IDs are missing." };
    }

    const result = await saveSublinkToDatabase(sublinkData);

    if (result.success) {
        // Revalidate the path to update the list on the sublinks page
        try {
            revalidatePath('/sublinks'); // Or the specific path where your sublink list is displayed
            console.log("Server Action: Path /sublinks revalidated.");
        } catch (revalError: any) {
            console.error("Server Action: Failed to revalidate path /sublinks:", revalError);
            // Not returning an error to the client for revalidation failure, but logging it.
            // The save itself was successful.
        }
    }

    return result;
} 