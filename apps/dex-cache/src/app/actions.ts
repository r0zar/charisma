'use server';

import { revalidatePath } from 'next/cache';
import {
    getVaultData,
    Vault,
    getManagedVaultIds as getVaultIdsFromService,
    removeVaults as removeVaultsFromService,
    getFungibleTokenBalance,
    getLpTokenTotalSupply,
    getLiquidityOperationQuote,
    getContractSourceDetails,
    addVaultToBlacklist,
    removeVaultFromBlacklist,
    getBlacklistedVaultIds,
    isVaultBlacklisted
} from "@/lib/pool-service";

import { OP_ADD_LIQUIDITY, OP_REMOVE_LIQUIDITY, OP_SWAP_A_TO_B, OP_SWAP_B_TO_A } from '@/lib/utils';
import { getStxTotalSupply } from '@repo/polyglot';

/** Force refresh vault data */
export async function refreshVaultData(contractId: string): Promise<{ success: boolean; error?: string; vault?: Vault }> {
    if (!contractId) return { success: false, error: 'ContractId required' };
    console.log(`Starting forced refresh for vault: ${contractId}`);
    try {
        const refreshedVault = await getVaultData(contractId);
        if (refreshedVault) {
            console.log(`Refresh process initiated for ${contractId}. Revalidating path.`);
            revalidatePath('/');
            return { success: true, vault: refreshedVault };
        } else {
            console.error(`Refresh failed for ${contractId}: Vault not found or cache error.`);
            return { success: false, error: 'Vault not found or failed to process during refresh.' };
        }
    } catch (error: any) {
        console.error(`Failed refresh vault ${contractId}:`, error);
        return { success: false, error: error.message || 'Failed during refresh' };
    }
}

// Action to remove a vault (dev only)
export async function removeVault(contractId: string): Promise<{ success: boolean; error?: string }> {
    if (process.env.NODE_ENV !== 'development') {
        return { success: false, error: 'Action only available in development.' };
    }
    if (!contractId) return { success: false, error: 'ContractId required.' };

    try {
        await removeVaultsFromService([contractId]);
        return { success: true };
    } catch (error: any) {
        console.error(`Failed removing vault ${contractId}:`, error);
        return { success: false, error: error.message || 'Failed to remove vault' };
    }
}

/**
 * Server Action to add a vault to the blacklist.
 * This removes it from cache and prevents it from appearing in API responses.
 * **Only works in development mode.**
 * @param contractId The vault contract ID to blacklist.
 */
export async function blacklistVault(contractId: string) {
    // Strict check for development environment
    if (process.env.NODE_ENV !== 'development') {
        return { success: false, error: 'This action is only available in development mode.' };
    }

    if (!contractId) {
        return { success: false, error: 'Contract ID is required.' };
    }

    try {
        console.log(`Attempting to blacklist vault ${contractId} (DEV MODE)...`);
        const result = await addVaultToBlacklist(contractId);

        if (result.success) {
            // Revalidate paths to reflect the change
            revalidatePath('/');
            revalidatePath('/admin');
            revalidatePath('/pools');
        }

        return result;
    } catch (error: any) {
        console.error(`Failed to blacklist vault ${contractId}:`, error);
        return { success: false, error: error.message || 'Failed to blacklist vault.' };
    }
}

/**
 * Server Action to remove a vault from the blacklist.
 * **Only works in development mode.**
 * @param contractId The vault contract ID to unblacklist.
 */
export async function unblacklistVault(contractId: string) {
    // Strict check for development environment
    if (process.env.NODE_ENV !== 'development') {
        return { success: false, error: 'This action is only available in development mode.' };
    }

    if (!contractId) {
        return { success: false, error: 'Contract ID is required.' };
    }

    try {
        console.log(`Attempting to unblacklist vault ${contractId} (DEV MODE)...`);
        const result = await removeVaultFromBlacklist(contractId);

        if (result.success) {
            // Revalidate paths to reflect the change
            revalidatePath('/');
            revalidatePath('/admin');
            revalidatePath('/pools');
        }

        return result;
    } catch (error: any) {
        console.error(`Failed to unblacklist vault ${contractId}:`, error);
        return { success: false, error: error.message || 'Failed to unblacklist vault.' };
    }
}

/**
 * Server Action to get all blacklisted vaults.
 * @returns Array of blacklisted vault contract IDs.
 */
export async function getBlacklistedVaults() {
    try {
        const blacklistedIds = await getBlacklistedVaultIds();
        return { success: true, data: blacklistedIds };
    } catch (error: any) {
        console.error('Failed to fetch blacklisted vaults:', error);
        return { success: false, error: error.message || 'Failed to fetch blacklisted vaults.', data: [] };
    }
}

/**
 * Server Action to check if a vault is blacklisted.
 * @param contractId The vault contract ID to check.
 * @returns Boolean indicating if vault is blacklisted.
 */
export async function checkVaultBlacklisted(contractId: string) {
    if (!contractId) {
        return { success: false, error: 'Contract ID is required.', isBlacklisted: false };
    }

    try {
        const blacklisted = await isVaultBlacklisted(contractId);
        return { success: true, isBlacklisted: blacklisted };
    } catch (error: any) {
        console.error(`Failed to check vault blacklist status for ${contractId}:`, error);
        return { success: false, error: error.message || 'Failed to check blacklist status.', isBlacklisted: false };
    }
}

// Get existing vault data
export async function getVault(contractId: string): Promise<Vault | null> { // For direct data access, might not need full success/error wrapper
    return await getVaultData(contractId);
}

// Get managed vault IDs
export async function getVaultIds(): Promise<string[]> { // For direct data access
    return await getVaultIdsFromService();
}

// Server action to fetch add liquidity data
export async function getAddLiquidityQuoteAndSupply(vaultContractId: string, targetLpAmount: number): Promise<{ success: boolean; error?: string; totalSupply?: number; quote?: { dx: number; dy: number; dk: number } | null }> {
    try {
        const [totalSupply, quote] = await Promise.all([
            getLpTokenTotalSupply(vaultContractId),
            targetLpAmount > 0
                ? getLiquidityOperationQuote(vaultContractId, targetLpAmount, OP_ADD_LIQUIDITY)
                : Promise.resolve(null)
        ]);
        return {
            success: true,
            totalSupply,
            quote
        };
    } catch (error: any) {
        console.error("Error in getAddLiquidityQuoteAndSupply:", error);
        return { success: false, error: error.message || "Failed to fetch add liquidity quote and supply" };
    }
}

// Server action to fetch remove liquidity data
export async function getRemoveLiquidityQuote(vaultContractId: string, targetLpAmountToBurn: number): Promise<{ success: boolean; error?: string; quote?: { dx: number; dy: number; dk: number } | null }> {
    try {
        const quote = targetLpAmountToBurn > 0
            ? await getLiquidityOperationQuote(vaultContractId, targetLpAmountToBurn, OP_REMOVE_LIQUIDITY)
            : null; // Ensure quote can be null if not fetched

        return {
            success: true,
            quote
        };
    } catch (error: any) {
        console.error("Error in getRemoveLiquidityQuote:", error);
        return { success: false, error: error.message || "Failed to fetch remove liquidity quote" };
    }
}

// Server action to fetch swap quote
export async function getSwapQuote(
    vaultContractId: string,
    amount: number,
    isAToB: boolean
): Promise<{ success: boolean; error?: string; quote?: { dx: number; dy: number; dk: number } | null; direction?: { inputToken: string; outputToken: string } }> {
    try {
        const operationCode = isAToB ? OP_SWAP_A_TO_B : OP_SWAP_B_TO_A;
        const quote = await getLiquidityOperationQuote(vaultContractId, amount, operationCode);

        // No need to throw if quote is null, just pass it along
        return {
            success: true,
            quote,
            direction: {
                inputToken: isAToB ? 'A' : 'B',
                outputToken: isAToB ? 'B' : 'A'
            }
        };
    } catch (error: any) {
        console.error("Error in getSwapQuote:", error);
        return { success: false, error: error.message || "Failed to fetch swap quote" };
    }
}

export async function getSwapAToB(vaultContractId: string, amountA: number) {
    return getSwapQuote(vaultContractId, amountA, true);
}

export async function getSwapBToA(vaultContractId: string, amountB: number) {
    return getSwapQuote(vaultContractId, amountB, false);
}

export async function getLpTokenBalance(
    vaultContractId: string,
    userAddress: string
): Promise<{ success: boolean; balance?: number; error?: string }> {
    try {
        const balance = await getFungibleTokenBalance(vaultContractId, userAddress);
        return {
            success: true,
            balance
        };
    } catch (error: any) {
        console.error(`Error in getLpTokenBalance for ${vaultContractId} / ${userAddress}:`, error);
        return {
            success: false,
            error: error.message || "Failed to fetch LP token balance."
        };
    }
}

export async function fetchContractInfo(contractId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        const contractInfo = await getContractSourceDetails(contractId);
        if (contractInfo) {
            return { success: true, data: contractInfo };
        }
        // If contractInfo is null (as returned by service on error), treat as failure
        return { success: false, error: "Failed to fetch contract details from service." };
    } catch (error: any) {
        console.error("Error in fetchContractInfo action:", error);
        return { success: false, error: error.message || "Failed to fetch contract info." };
    }
}

/**
 * Server action to fetch initial data needed for the Add Liquidity modal:
 * - Token A balance for the user
 * - Token B balance for the user
 * - LP Token balance for the user
 * - LP Token total supply
 */
export async function getAddLiquidityInitialData(
    vaultContractId: string,
    tokenAContractId: string,
    tokenBContractId: string,
    userAddress: string
) {
    try {
        const vaultData = await getVaultData(vaultContractId);
        if (!vaultData) {
            throw new Error(`Vault data not found for ${vaultContractId}`);
        }
        if (vaultData.reservesA === undefined || vaultData.reservesB === undefined) {
            throw new Error(`Reserves not available for vault ${vaultContractId}`);
        }

        const [tokenABalance, tokenBBalance, lpBalance, totalSupply] = await Promise.all([
            getFungibleTokenBalance(tokenAContractId, userAddress),
            getFungibleTokenBalance(tokenBContractId, userAddress),
            getFungibleTokenBalance(vaultContractId, userAddress), // LP token balance
            getLpTokenTotalSupply(vaultContractId)
        ]);

        let maxPotentialLpTokens = 0;
        const userBalanceA = Number(tokenABalance || 0);
        const userBalanceB = Number(tokenBBalance || 0);
        const poolReserveA = Number(vaultData.reservesA || 0);
        const poolReserveB = Number(vaultData.reservesB || 0);
        const currentLpTotalSupply = Number(totalSupply || 0);

        if (userBalanceA > 0 && userBalanceB > 0 && poolReserveA > 0 && poolReserveB > 0 && currentLpTotalSupply > 0) {
            const maxLpIfUsingAllA = (userBalanceA / poolReserveA) * currentLpTotalSupply;
            const maxLpIfUsingAllB = (userBalanceB / poolReserveB) * currentLpTotalSupply;
            maxPotentialLpTokens = Math.min(maxLpIfUsingAllA, maxLpIfUsingAllB);
        }

        return {
            success: true,
            data: {
                tokenABalance,
                tokenBBalance,
                lpBalance,
                totalSupply,
                reservesA: poolReserveA, // Also return reserves for potential client use
                reservesB: poolReserveB, // Also return reserves for potential client use
                maxPotentialLpTokens
            }
        };
    } catch (error) {
        console.error("Error in getAddLiquidityInitialData:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch initial liquidity data.";
        return {
            success: false,
            error: errorMessage
        };
    }
}

/**
 * Server action to fetch total supply for any token contract
 */
export async function getTokenTotalSupply(tokenContractId: string): Promise<{ success: boolean; totalSupply?: number; error?: string }> {
    try {
        if (!tokenContractId || tokenContractId === '.stx') {
            // Use the polyglot function to get real STX total supply
            const stxTotalSupply = await getStxTotalSupply();
            // Convert from STX to microSTX (multiply by 1,000,000)
            const microStxSupply = (stxTotalSupply * 1_000_000)
            return {
                success: true,
                totalSupply: microStxSupply
            };
        }

        const totalSupply = await getLpTokenTotalSupply(tokenContractId);
        return {
            success: true,
            totalSupply
        };
    } catch (error) {
        console.error("Error in getTokenTotalSupply:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch token total supply"
        };
    }
}

/**
 * Server action to fetch token metadata for a contract ID
 */
export async function getTokenMetadata(contractId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        if (!contractId || (!contractId.includes('.') && contractId !== '.stx')) {
            return { success: false, error: 'Invalid contract ID format' };
        }

        // For STX, return predefined metadata
        if (contractId === '.stx') {
            return {
                success: true,
                data: {
                    contractId: '.stx',
                    name: 'Stacks',
                    symbol: 'STX',
                    decimals: 6,
                    description: 'The native token of the Stacks blockchain',
                    image: 'https://cryptologos.cc/logos/stacks-stx-logo.png',
                    identifier: 'STX'
                }
            };
        }

        // Use the shared token cache client (it's available in the dex-cache context)
        const { getTokenMetadataCached } = await import('@repo/tokens');
        const metadata = await getTokenMetadataCached(contractId);

        if (metadata && metadata.name) {
            return {
                success: true,
                data: {
                    contractId: metadata.contractId || contractId,
                    name: metadata.name,
                    symbol: metadata.symbol || '',
                    decimals: metadata.decimals || 6,
                    description: metadata.description || '',
                    image: metadata.image || '',
                    identifier: metadata.identifier || metadata.symbol || ''
                }
            };
        } else {
            return { success: false, error: 'Token metadata not found or incomplete' };
        }
    } catch (error) {
        console.error("Error in getTokenMetadata:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch token metadata"
        };
    }
}