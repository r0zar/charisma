'use server';

import { Cryptonomicon, TokenMetadata } from "@repo/cryptonomicon";

// Initialize Cryptonomicon
// Ensure API key is available in the launchpad app's environment variables
const cryptonomicon = new Cryptonomicon({
    debug: process.env.NODE_ENV === 'development',
    apiKey: process.env.HIRO_API_KEY, // This needs to be configured for the launchpad app
});

/**
 * Server Action to fetch metadata for a pair of tokens directly using Cryptonomicon.
 * @param contractId1 The contract ID of the first token.
 * @param contractId2 The contract ID of the second token.
 * @returns A promise resolving to an object with metadata for both tokens or an error.
 */
export async function fetchTokenMetadataPairDirectly(
    contractId1: string,
    contractId2: string
): Promise<{ token1Meta: TokenMetadata | null; token2Meta: TokenMetadata | null; error?: string }> {
    console.log(`[Launchpad Action] Fetching metadata directly for pair: ${contractId1}, ${contractId2}`);
    try {
        // Fetch metadata for both tokens in parallel
        const [meta1Result, meta2Result] = await Promise.allSettled([
            cryptonomicon.getTokenMetadata(contractId1),
            cryptonomicon.getTokenMetadata(contractId2)
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
 * Server Action to fetch metadata for a single token directly using Cryptonomicon.
 * @param contractId The contract ID of the token.
 * @returns A promise resolving to an object with the token metadata or an error.
 */
export async function fetchSingleTokenMetadataDirectly(
    contractId: string
): Promise<{ meta: TokenMetadata | null; error?: string }> {
    if (!contractId || !contractId.includes('.')) {
        return { meta: null, error: 'Contract ID is required and must be valid.' };
    }
    console.log(`[Launchpad Action] Fetching metadata directly for single token: ${contractId}`);
    try {
        const metadata = await cryptonomicon.getTokenMetadata(contractId);
        return { meta: metadata, error: undefined };
    } catch (error: any) {
        console.error(`[Launchpad Action] Error fetching metadata for ${contractId}:`, error);
        return { meta: null, error: error.message || 'Failed to process token metadata.' };
    }
} 