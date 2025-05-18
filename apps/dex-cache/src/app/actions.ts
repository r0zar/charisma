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
    getContractSourceDetails
} from "@/lib/vaultService";

import { OP_ADD_LIQUIDITY, OP_REMOVE_LIQUIDITY, OP_SWAP_A_TO_B, OP_SWAP_B_TO_A } from '@/lib/utils';

/** Force refresh vault data */
export async function refreshVaultData(contractId: string): Promise<{ success: boolean; error?: string; vault?: Vault }> {
    if (!contractId) return { success: false, error: 'ContractId required' };
    console.log(`Starting forced refresh for vault: ${contractId}`);
    try {
        const refreshedVault = await getVaultData(contractId, true);
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
                : Promise.resolve(null) // Ensure quote can be null if not fetched
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
        console.log(`[Server Action] Fetching initial data for ${vaultContractId} / ${userAddress}`);
        const [tokenABalance, tokenBBalance, lpBalance, totalSupply] = await Promise.all([
            getFungibleTokenBalance(tokenAContractId, userAddress),
            getFungibleTokenBalance(tokenBContractId, userAddress),
            getFungibleTokenBalance(vaultContractId, userAddress), // LP token balance
            getLpTokenTotalSupply(vaultContractId)
        ]);

        console.log(`[Server Action] Data fetched: A=${tokenABalance}, B=${tokenBBalance}, LP=${lpBalance}, Supply=${totalSupply}`);

        return {
            success: true,
            data: {
                tokenABalance,
                tokenBBalance,
                lpBalance,
                totalSupply
            }
        };
    } catch (error) {
        console.error("Error in getAddLiquidityInitialData:", error);
        return {
            success: false,
            error: "Failed to fetch initial liquidity data."
        };
    }
}