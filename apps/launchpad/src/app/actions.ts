'use server';

import { getTokenMetadataCached, TokenCacheData } from "@repo/tokens";
import { kv } from '@vercel/kv';

/**
 * Server Action to fetch metadata for a pair of tokens directly.
 * @param contractId1 The contract ID of the first token.
 * @param contractId2 The contract ID of the second token.
 * @returns A promise resolving to an object with metadata for both tokens or an error.
 */
export async function fetchTokenMetadataPairDirectly(
    contractId1: string,
    contractId2: string
): Promise<{ token1Meta: TokenCacheData | null; token2Meta: TokenCacheData | null; error?: string }> {
    console.log(`[Launchpad Action] Fetching metadata directly for pair: ${contractId1}, ${contractId2}`);
    try {
        // Fetch metadata for both tokens in parallel
        const [meta1Result, meta2Result] = await Promise.allSettled([
            getTokenMetadataCached(contractId1),
            getTokenMetadataCached(contractId2)
        ]);

        const token1Meta = meta1Result.status === 'fulfilled' ? meta1Result.value : null;
        const token2Meta = meta2Result.status === 'fulfilled' ? meta2Result.value : null;

        if (meta1Result.status === 'rejected') {
            console.error(`[Launchpad Action] Error fetching metadata for ${contractId1}:`, meta1Result.reason);
        }
        if (meta2Result.status === 'rejected') {
            console.error(`[Launchpad Action] Error fetching metadata for ${contractId2}:`, meta2Result.reason);
        }

        // Even if one fails, we return what we have, client can check for nulls
        return { token1Meta, token2Meta };

    } catch (error: any) {
        // This catch is for unexpected errors in Promise.allSettled
        console.error(`[Launchpad Action] Failed to fetch token metadata pair directly:`, error);
        return { token1Meta: null, token2Meta: null, error: error.message || 'Failed to process token metadata pair.' };
    }
}

/**
 * Server Action to fetch metadata for a single token directly.
 * @param contractId The contract ID of the token.
 * @returns A promise resolving to an object with the token metadata or an error.
 */
export async function fetchSingleTokenMetadataDirectly(
    contractId: string
): Promise<{ meta: TokenCacheData | null; error?: string }> {
    if (!contractId || !contractId.includes('.')) {
        return { meta: null, error: 'Contract ID is required and must be valid.' };
    }
    console.log(`[Launchpad Action] Fetching metadata directly for single token: ${contractId}`);
    try {
        const metadata = await getTokenMetadataCached(contractId);
        return { meta: metadata, error: undefined };
    } catch (error: any) {
        console.error(`[Launchpad Action] Error fetching metadata for ${contractId}:`, error);
        return { meta: null, error: error.message || 'Failed to process token metadata.' };
    }
}

export interface Vault {
    type: string;
    protocol: string;
    contractId: string;
    name: string;
    symbol: string;
    decimals: number;
    identifier: string;
    description: string;
    image: string;
    fee: number;
    tokenA: any;
    tokenB: any;
}

/**
 * Interface for the data structure to be saved in Vercel KV for Sublinks.
 */
export interface SublinkDexEntry {
    name: string;
    image: string; // data URI
    contractId: string; // The sublink contract identifier itself
    type: "SUBLINK";
    protocol: string; // e.g., 'CHARISMA'
    tokenAContract: string; // Source token (e.g., mainnet SIP-10)
    tokenBContract: string; // Subnet token representation=
    tokenA: TokenCacheData; // Full metadata for the source token
    tokenB: TokenCacheData; // Full metadata for the subnet token=
    // Add other SUBLINK specific fields if necessary from dex-cache perspective
}

/**
 * Server action to save token metadata to the dex-cache (Vercel KV).
 * This function is intended to be called after metadata is successfully generated or updated for a liquidity pool.
 */
export async function saveMetadataToDexCache(
    contractId: string,
    vault: Vault
): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!contractId) {
        console.error("[saveMetadataToDexCache] Contract ID is required.");
        return { success: false, error: "Contract ID is required." };
    }
    if (!vault || Object.keys(vault).length === 0) {
        console.error("[saveMetadataToDexCache] Metadata is required.");
        return { success: false, error: "Metadata is required." };
    }

    const kvKey = `dex-vault:${contractId}`;

    try {
        console.log(`[saveMetadataToDexCache] Saving metadata to Vercel KV for key: ${kvKey}`, vault);
        await kv.set(kvKey, vault);

        console.log(`[saveMetadataToDexCache] Successfully saved metadata for ${contractId} to Vercel KV.`);
        return { success: true, message: "Metadata saved to dex-cache successfully." };

    } catch (error: any) {
        console.error(`[saveMetadataToDexCache] Error saving metadata to Vercel KV for ${contractId}:`, error);
        return {
            success: false,
            error: error.message || "An unexpected error occurred while saving metadata to dex-cache.",
        };
    }
}

/**
 * Enhanced server action to save Sublink data with full token metadata to the dex-cache (Vercel KV).
 */
export async function saveSublinkDataToDexCache(
    sublinkContractId: string,
    sublinkData: SublinkDexEntry
): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!sublinkContractId) {
        console.error("[saveSublinkDataToDexCache] Sublink Contract ID is required.");
        return { success: false, error: "Sublink Contract ID is required." };
    }
    if (!sublinkData || Object.keys(sublinkData).length === 0) {
        console.error("[saveSublinkDataToDexCache] Sublink data is required.");
        return { success: false, error: "Sublink data is required." };
    }
    if (sublinkData.type !== "SUBLINK") {
        console.error("[saveSublinkDataToDexCache] Invalid type for Sublink data.");
        return { success: false, error: "Invalid type, expected SUBLINK." };
    }
    if (!sublinkData.tokenA || !sublinkData.tokenB) {
        console.error("[saveSublinkDataToDexCache] Both tokenA and tokenB metadata are required.");
        return { success: false, error: "Both tokenA and tokenB metadata are required." };
    }

    const kvKey = `dex-vault:${sublinkContractId}`;

    try {
        console.log(`[saveSublinkDataToDexCache] Saving enhanced Sublink data to Vercel KV for key: ${kvKey}`, sublinkData);
        await kv.set(kvKey, sublinkData);

        console.log(`[saveSublinkDataToDexCache] Successfully saved enhanced Sublink data for ${sublinkContractId} to Vercel KV.`);
        return { success: true, message: "Enhanced sublink data with full token metadata saved to dex-cache successfully." };

    } catch (error: any) {
        console.error(`[saveSublinkDataToDexCache] Error saving Sublink data to Vercel KV for ${sublinkContractId}:`, error);
        return {
            success: false,
            error: error.message || "An unexpected error occurred while saving Sublink data to dex-cache.",
        };
    }
}

/**
 * Utility function to enhance existing sublink metadata with full tokenA and tokenB data.
 * This can be used to update existing sublinks that don't have the complete token metadata.
 */
export async function enhanceSublinkWithTokenMetadata(
    sublinkContractId: string,
    tokenAContract: string,
    tokenBContract: string
): Promise<{ success: boolean; message?: string; error?: string; enhancedData?: SublinkDexEntry }> {
    if (!sublinkContractId || !tokenAContract || !tokenBContract) {
        return { success: false, error: "All contract IDs are required." };
    }

    try {
        console.log(`[enhanceSublinkWithTokenMetadata] Enhancing sublink ${sublinkContractId} with token metadata`);

        // Fetch full metadata for both tokens
        const [tokenAResult, tokenBResult] = await Promise.allSettled([
            getTokenMetadataCached(tokenAContract),
            getTokenMetadataCached(tokenBContract)
        ]);

        const tokenAMeta = tokenAResult.status === 'fulfilled' ? tokenAResult.value : null;
        const tokenBMeta = tokenBResult.status === 'fulfilled' ? tokenBResult.value : null;

        if (!tokenAMeta || !tokenBMeta) {
            const errors = [];
            if (!tokenAMeta) errors.push(`Failed to fetch metadata for tokenA: ${tokenAContract}`);
            if (!tokenBMeta) errors.push(`Failed to fetch metadata for tokenB: ${tokenBContract}`);
            return { success: false, error: errors.join(', ') };
        }

        // Create enhanced sublink data structure
        const enhancedSublinkData: SublinkDexEntry = {
            name: `${tokenAMeta.symbol || 'Token'}-sublink`,
            image: tokenAMeta.image || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjcH5Z/R8ABcECp4N5vh4AAAAASUVORK5CYII=',
            contractId: sublinkContractId,
            type: "SUBLINK",
            protocol: "CHARISMA",
            tokenAContract,
            tokenBContract,
            tokenA: tokenAMeta,
            tokenB: tokenBMeta,
        };

        console.log(`[enhanceSublinkWithTokenMetadata] Successfully enhanced sublink metadata for ${sublinkContractId}`);
        return {
            success: true,
            message: "Sublink metadata enhanced with full token data.",
            enhancedData: enhancedSublinkData
        };

    } catch (error: any) {
        console.error(`[enhanceSublinkWithTokenMetadata] Error enhancing sublink ${sublinkContractId}:`, error);
        return {
            success: false,
            error: error.message || "An unexpected error occurred while enhancing sublink metadata.",
        };
    }
}

/**
 * Function to update an existing sublink with enhanced metadata.
 * This can be called to fix existing sublinks that don't have complete token metadata.
 */
export async function updateExistingSublinkMetadata(
    sublinkContractId: string,
    tokenAContract: string,
    tokenBContract: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        // First, enhance the metadata
        const enhanceResult = await enhanceSublinkWithTokenMetadata(
            sublinkContractId,
            tokenAContract,
            tokenBContract
        );

        if (!enhanceResult.success || !enhanceResult.enhancedData) {
            return enhanceResult;
        }

        // Then save the enhanced data to the dex cache
        const saveResult = await saveSublinkDataToDexCache(
            sublinkContractId,
            enhanceResult.enhancedData
        );

        if (saveResult.success) {
            return {
                success: true,
                message: `Successfully updated sublink ${sublinkContractId} with enhanced metadata including full tokenA and tokenB data.`
            };
        } else {
            return saveResult;
        }

    } catch (error: any) {
        console.error(`[updateExistingSublinkMetadata] Error updating sublink ${sublinkContractId}:`, error);
        return {
            success: false,
            error: error.message || "An unexpected error occurred while updating sublink metadata.",
        };
    }
} 