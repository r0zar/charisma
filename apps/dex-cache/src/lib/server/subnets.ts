'use server'

import { getAccountBalances } from "@repo/polyglot";
import { getTokenMetadataCached } from "@repo/tokens";

/**
 * Server action to fetch the total token balance held by a specific contract.
 * This uses the Stacks API directly to get accurate token counts.
 */
export async function getTokenBalanceForContract(
    contractAddress: string,
    tokenContractId: string
): Promise<{
    success: boolean;
    balance?: number;
    tokenDecimals?: number;
    error?: string;
}> {
    try {
        // First, fetch token metadata to get the proper identifier and decimals
        let tokenIdentifier: string | undefined;
        let tokenDecimals: number | undefined;

        if (tokenContractId === '.stx') {
            // STX token has 6 decimals
            tokenDecimals = 6;
        } else {
            try {
                const tokenMetadata = await getTokenMetadataCached(tokenContractId);
                if (tokenMetadata) {
                    // Get identifier from metadata
                    if (tokenMetadata.identifier) {
                        tokenIdentifier = tokenMetadata.identifier;
                    } else {
                        // If we can't find the identifier, get the token name from the contract ID
                        const [, tokenName] = tokenContractId.split('.');
                        tokenIdentifier = tokenName;
                    }

                    // Get decimals from metadata
                    if (tokenMetadata.decimals !== undefined) {
                        tokenDecimals = tokenMetadata.decimals;
                    }
                } else {
                    // If we can't find the metadata, get the token name from the contract ID
                    const [, tokenName] = tokenContractId.split('.');
                    tokenIdentifier = tokenName;
                }
            } catch (error) {
                console.error(`Error fetching token metadata for ${tokenContractId}:`, error);
                // Default to using the token name if metadata fetch fails
                const [, tokenName] = tokenContractId.split('.');
                tokenIdentifier = tokenName;
            }
        }

        // Use the getAccountBalances function from polyglot
        const balancesData = await getAccountBalances(contractAddress);

        if (!balancesData) {
            return {
                success: false,
                error: `No balance data found for contract ${contractAddress}`
            };
        }

        if (tokenContractId === '.stx') {
            // Handle STX token case
            const balance = parseInt(balancesData.stx?.balance || '0');
            return {
                success: true,
                balance,
                tokenDecimals // Will be 6 for STX
            };
        } else {
            // For fungible tokens, look through the fungible_tokens object
            // Construct the standard format token ID using the fetched identifier
            const tokenFullId = `${tokenContractId}::${tokenIdentifier}`;

            // First check the standard format
            if (balancesData.fungible_tokens && balancesData.fungible_tokens[tokenFullId]) {
                const balance = parseInt(balancesData.fungible_tokens[tokenFullId].balance || '0');
                return {
                    success: true,
                    balance,
                    tokenDecimals // Use the decimals from metadata
                };
            }

            // Try alternative formats - some tokens might be indexed differently
            for (const key in balancesData.fungible_tokens) {
                if (key.includes(tokenContractId) ||
                    (tokenIdentifier && key.includes(tokenIdentifier))) {
                    const balance = parseInt(balancesData.fungible_tokens[key].balance || '0');
                    return {
                        success: true,
                        balance,
                        tokenDecimals // Use the decimals from metadata
                    };
                }
            }

            // If we reach here, the token wasn't found in the API response
            return {
                success: false,
                error: `Token ${tokenContractId} not found in balance data for contract. The token may not exist or have no balance.`
            };
        }
    } catch (error) {
        console.error(`Error in getTokenBalanceForContract:`, error);
        return {
            success: false,
            error: String(error)
        };
    }
}