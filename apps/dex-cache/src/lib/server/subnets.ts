'use server'

import { getAccountBalances } from "@repo/polyglot";
import { getTokenMetadataCached } from "@repo/tokens";

/**
 * Helper function to get the subnet token contract ID.
 * The subnet contract address is stored as the B token in the sublink's metadata.
 */
async function getSubnetTokenContractId(sublinkContractId: string): Promise<string> {
    try {
        // Fetch the sublink metadata to get the subnet contract
        const sublinkMetadata = await getTokenMetadataCached(sublinkContractId);

        if (!sublinkMetadata || !sublinkMetadata.tokenBContract) {
            console.error(`[Server Action] Could not find subnet contract in sublink metadata for ${sublinkContractId}`);
            throw new Error(`Subnet contract not found in sublink metadata`);
        }

        // The subnet contract address is stored as the B token in the sublink's metadata
        const subnetContractId = sublinkMetadata.tokenBContract;
        console.log(`[Server Action] Found subnet contract ID: ${subnetContractId}`);

        return subnetContractId;
    } catch (error) {
        console.error(`[Server Action] Error getting subnet contract ID:`, error);
        throw error;
    }
}

/**
 * Server action to fetch the total token balance held by a subnet contract.
 * This uses the Stacks API directly to get accurate token counts.
 */
export async function getSubnetTokenBalance(sublinkContractId: string, tokenContractId: string): Promise<{
    success: boolean;
    balance?: number;
    tokenDecimals?: number;
    error?: string;
}> {
    try {
        console.log(`[Server Action] Fetching subnet balance for ${sublinkContractId}, token ${tokenContractId}`);

        // Get the subnet contract principal - now with await as it's async
        const subnetContractId = await getSubnetTokenContractId(sublinkContractId);

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
                        console.log(`[Server Action] Found token identifier: ${tokenIdentifier}`);
                    } else {
                        // If we can't find the identifier, get the token name from the contract ID
                        const [, tokenName] = tokenContractId.split('.');
                        tokenIdentifier = tokenName;
                        console.log(`[Server Action] No identifier found, using token name: ${tokenIdentifier}`);
                    }

                    // Get decimals from metadata
                    if (tokenMetadata.decimals !== undefined) {
                        tokenDecimals = tokenMetadata.decimals;
                        console.log(`[Server Action] Found token decimals: ${tokenDecimals}`);
                    } else {
                        console.log(`[Server Action] Token decimals not found in metadata, will return undefined`);
                    }
                } else {
                    // If we can't find the metadata, get the token name from the contract ID
                    const [, tokenName] = tokenContractId.split('.');
                    tokenIdentifier = tokenName;
                    console.log(`[Server Action] No metadata found, using token name: ${tokenIdentifier}`);
                }
            } catch (error) {
                console.error(`[Server Action] Error fetching token metadata: ${error}`);
                // Default to using the token name if metadata fetch fails
                const [, tokenName] = tokenContractId.split('.');
                tokenIdentifier = tokenName;
                console.log(`[Server Action] Using token name as fallback: ${tokenIdentifier}`);
            }
        }

        // Use the new getAccountBalances function from polyglot
        const balancesData = await getAccountBalances(subnetContractId);

        console.log(`[Server Action] Balances data: ${JSON.stringify(balancesData)}`);

        if (!balancesData) {
            console.error(`[Server Action] No balance data found for ${subnetContractId}`);
            return {
                success: false,
                error: `No balance data found for subnet contract ${subnetContractId}`
            };
        }

        if (tokenContractId === '.stx') {
            // Handle STX token case
            const balance = parseInt(balancesData.stx?.balance || '0');
            console.log(`[Server Action] Subnet STX Balance from API: ${balance}`);
            return {
                success: true,
                balance,
                tokenDecimals // Will be 6 for STX
            };
        } else {
            // For fungible tokens, look through the fungible_tokens object
            // Construct the standard format token ID using the fetched identifier
            const tokenFullId = `${tokenContractId}::${tokenIdentifier}`;
            console.log(`[Server Action] Looking for token with ID: ${tokenFullId}`);

            // First check the standard format
            if (balancesData.fungible_tokens && balancesData.fungible_tokens[tokenFullId]) {
                const balance = parseInt(balancesData.fungible_tokens[tokenFullId].balance || '0');
                console.log(`[Server Action] Found token balance at ${tokenFullId}: ${balance}`);
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
                    console.log(`[Server Action] Found token at alternative key ${key}: ${balance}`);
                    return {
                        success: true,
                        balance,
                        tokenDecimals // Use the decimals from metadata
                    };
                }
            }

            // If we reach here, the token wasn't found in the API response
            console.log(`[Server Action] Token ${tokenContractId} not found in API response for subnet ${subnetContractId}`);
            return {
                success: false,
                error: `Token ${tokenContractId} not found in balance data for subnet contract. The token may not exist or have no balance.`
            };
        }
    } catch (error) {
        console.error(`Error in getSubnetTokenBalance:`, error);
        return {
            success: false,
            error: String(error)
        };
    }
}