'use server';

import { getTokenMetadataCached, TokenCacheData, listTokens, SIP10 } from "@repo/tokens";
import { kv } from '@vercel/kv';
import { TokenMetadata } from "@/lib/metadata-service";

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
    tokenA: SIP10;
    tokenB: SIP10;
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