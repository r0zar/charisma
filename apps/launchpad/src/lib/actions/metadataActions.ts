'use server';

import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens';
// Or revalidatePath if more appropriate
import { kv } from "@vercel/kv"; // Import Vercel KV

// --- Placeholder for actual metadata persistence --- 
// In a real application, this would interact with your database or API 
// that serves the token metadata for getTokenMetadataCached and listTokens.
async function saveSubnetMetadata(
    subnetMetadata: TokenCacheData
): Promise<{ success: boolean; error?: string; message?: string }> {
    if (!subnetMetadata || !subnetMetadata.contractId) {
        console.error('[saveSubnetMetadata] Invalid subnet metadata or missing contractId.');
        return { success: false, error: 'Invalid subnet metadata provided.' };
    }
    const kvKey = `sip10:${subnetMetadata.contractId}`;
    try {
        console.log(`[saveSubnetMetadata] Attempting to save subnet metadata to KV. Key: ${kvKey}`, subnetMetadata);
        await kv.set(kvKey, subnetMetadata);
        console.log('[saveSubnetMetadata] Subnet metadata saved successfully to KV.');
        return { success: true, message: 'Subnet metadata saved to KV store.' };
    } catch (error: any) {
        console.error(`[saveSubnetMetadata] Error saving subnet metadata to KV (Key: ${kvKey}):`, error);
        return { success: false, error: error.message || 'Failed to save subnet metadata to KV store.' };
    }
}
// --- End Placeholder --- 

export interface CreateSubnetMetadataParams {
    deployedSubnetContractId: string;
    baseTokenContractId: string;
    // Potentially include other subnet-specific initial properties if needed
}

export async function createSubnetMetadataAction(
    params: CreateSubnetMetadataParams
): Promise<{ success: boolean; error?: string; message?: string, createdMetadata?: TokenCacheData }> {
    const { deployedSubnetContractId, baseTokenContractId } = params;

    if (!deployedSubnetContractId || !baseTokenContractId) {
        return { success: false, error: 'Deployed subnet contract ID and base token contract ID are required.' };
    }

    console.log(`[createSubnetMetadataAction] Creating metadata for subnet ${deployedSubnetContractId} based on ${baseTokenContractId}`);

    try {
        const baseTokenMetadata = await getTokenMetadataCached(baseTokenContractId);

        if (!baseTokenMetadata || !baseTokenMetadata.contractId) {
            return { success: false, error: `Failed to fetch metadata for base token: ${baseTokenContractId}` };
        }

        const subnetMetadata = {
            ...baseTokenMetadata,
            contractId: deployedSubnetContractId,
            type: 'SUBNET',
            base: baseTokenContractId,
        }

        // Persist the new subnet metadata
        const saveResult = await saveSubnetMetadata(subnetMetadata);

        if (!saveResult.success) {
            return { success: false, error: saveResult.error || 'Failed to save the generated subnet metadata.' };
        }
        console.log('[createSubnetMetadataAction] Subnet metadata created and persistence initiated.');

        return {
            success: true,
            message: 'Subnet metadata successfully created and saved (simulated).',
            createdMetadata: subnetMetadata
        };

    } catch (error: any) {
        console.error('[createSubnetMetadataAction] Error:', error);
        return { success: false, error: error.message || 'An unexpected error occurred while creating subnet metadata.' };
    }
} 