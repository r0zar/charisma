'use server';

import { revalidatePath } from 'next/cache';
import {
    fetchTokenFromCache,
    getVaultData,
    saveVaultData,
    VAULT_LIST_KEY,
    getCacheKey,
    Vault
} from "@/lib/vaultService";
import { kv } from '@vercel/kv';
import { parseTokenMetadata } from '@/lib/openai';
import { callReadOnlyFunction, getContractInfo } from '@repo/polyglot';
import { principalCV, uintCV, bufferCVFromString, cvToValue, optionalCVOf } from '@stacks/transactions';
import { bufferFromHex } from '@stacks/transactions/dist/cl';

// Import getManagedVaultIds from vaultService but rename to avoid conflict
import { getManagedVaultIds as getVaultIdsFromService } from "@/lib/vaultService";
import { OP_ADD_LIQUIDITY, OP_REMOVE_LIQUIDITY, OP_SWAP_A_TO_B, OP_SWAP_B_TO_A } from '@/lib/utils';

/**
 * Fetches the list of managed vault IDs from Vercel KV.
 */
const getManagedVaultIds = async (): Promise<string[]> => {
    try {
        const ids = await kv.get<string[]>(VAULT_LIST_KEY);
        return Array.isArray(ids) ? ids : [];
    } catch (error) {
        console.error(`Error fetching vault list from KV (${VAULT_LIST_KEY}):`, error);
        return [];
    }
};

/** Remove vault from KV list (dev only) */
export async function removeVaultFromList(contractId: string) {
    if (process.env.NODE_ENV !== 'development') {
        return { success: false, error: 'Action only in development.' };
    }
    if (!contractId) return { success: false, error: 'ContractId required' };
    try {
        const list = await getManagedVaultIds();
        if (!list.includes(contractId)) {
            return { success: false, error: 'Vault not in list' };
        }
        await kv.set(VAULT_LIST_KEY, list.filter(id => id !== contractId));
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('Failed removing vault', error);
        return { success: false, error: error.message || 'Failed' };
    }
}

/** Force refresh vault data */
export async function refreshVaultData(contractId: string) {
    if (!contractId) return { success: false, error: 'ContractId required' };
    console.log(`Starting forced refresh for vault: ${contractId}`);
    try {
        // Directly call getVaultData with refresh = true.
        // This triggers the reserve fetching logic (primary + backup) inside getVaultData.
        const refreshedVault = await getVaultData(contractId, true);

        if (refreshedVault) {
            // getVaultData handles saving the updated vault back to KV asynchronously
            // if reserves were successfully updated.
            console.log(`Refresh process initiated for ${contractId}. Revalidating path.`);
            revalidatePath('/'); // Revalidate UI
            return { success: true };
        } else {
            // This case might occur if the vault wasn't found in cache initially
            // or if there was an error reading the cache within getVaultData.
            console.error(`Refresh failed for ${contractId}: Vault not found or cache error during refresh process.`);
            return { success: false, error: 'Vault not found or failed to process during refresh.' };
        }

    } catch (error: any) {
        console.error(`Failed refresh vault ${contractId}:`, error);
        return { success: false, error: error.message || 'Failed during refresh' };
    }
}

/** Add new vault by fetching + caching directly */
export async function addVault(contractId: string) {
    if (!contractId) return { success: false, error: 'ContractId required' };
    try {
        // Using our new two-step process instead of direct getVaultData call
        const preview = await previewVault(contractId);
        if (!preview.success || !preview.lpToken || !preview.tokenA || !preview.tokenB) {
            return { success: false, error: preview.error || 'Failed to fetch data' };
        }

        const confirm = await confirmVault(contractId, preview.lpToken, preview.tokenA, preview.tokenB);
        if (!confirm.success) {
            return { success: false, error: confirm.error || 'Failed to save vault' };
        }

        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('Failed add vault', error);
        return { success: false, error: error.message || 'Failed' };
    }
}

// STEP 1: Preview a vault - fetch data but don't save it
export async function previewVault(contractId: string): Promise<{
    success: boolean;
    lpToken?: any;
    tokenA?: any;
    tokenB?: any;
    error?: string;
    requiresManualInput?: boolean;
}> {
    // Special exception for .stx or other special tokens
    const isSpecialToken = contractId === '.stx';
    if (!contractId || (!isSpecialToken && !contractId.includes('.'))) {
        return { success: false, error: 'Invalid contract ID format.', requiresManualInput: false };
    }

    console.log(`Starting preview for ${contractId}`);
    try {
        // 1. Fetch LP token metadata
        console.log(`Step 1: Fetching LP token metadata for ${contractId}`);
        const lpToken = await fetchTokenFromCache(contractId);
        if (!lpToken) {
            return {
                success: false,
                error: `Failed to fetch LP token metadata for ${contractId}. Is it in token-cache?`,
                requiresManualInput: false
            };
        }

        // 3. Extract token contract IDs from various possible locations
        const tokenAContract = lpToken.tokenAContract ||
            (lpToken.properties?.tokenAContract) ||
            (lpToken.tokenA?.contractId) ||
            (lpToken.tokenA?.contract_principal);

        const tokenBContract = lpToken.tokenBContract ||
            (lpToken.properties?.tokenBContract) ||
            (lpToken.tokenB?.contractId) ||
            (lpToken.tokenB?.contract_principal);

        // If contracts couldn't be determined, return success but indicate manual input is needed
        if (!tokenAContract || !tokenBContract) {
            console.warn(`Could not automatically determine Token A/B contracts for ${contractId}. Requires manual input.`);
            return {
                success: true,
                lpToken,
                requiresManualInput: true,
            };
        }

        console.log(`Found token contracts: A=${tokenAContract}, B=${tokenBContract}`);

        // 4. Fetch Token A metadata if needed
        let tokenA = lpToken.tokenA;
        if (!tokenA || !tokenA.contractId) {
            console.log(`Step 2: Fetching Token A (${tokenAContract})`);
            tokenA = await fetchTokenFromCache(tokenAContract);
            if (!tokenA) {
                return {
                    success: false,
                    lpToken,
                    error: `Failed to fetch Token A (${tokenAContract}) from token-cache.`,
                    requiresManualInput: false
                };
            }
        } else {
            console.log(`Using Token A from LP token data: ${tokenA.name} (${tokenA.symbol})`);
        }

        // 5. Fetch Token B metadata if needed
        let tokenB = lpToken.tokenB;
        if (!tokenB || !tokenB.contractId) {
            console.log(`Step 3: Fetching Token B (${tokenBContract})`);
            tokenB = await fetchTokenFromCache(tokenBContract);
            if (!tokenB) {
                return {
                    success: false,
                    lpToken,
                    tokenA,
                    error: `Failed to fetch Token B (${tokenBContract}) from token-cache.`,
                    requiresManualInput: false
                };
            }
        } else {
            console.log(`Using Token B from LP token data: ${tokenB.name} (${tokenB.symbol})`);
        }

        // Return fetched data directly
        return {
            success: true,
            lpToken, // Return original LP token data
            tokenA, // Return original/fetched Token A
            tokenB, // Return original/fetched Token B
            requiresManualInput: false
        };

    } catch (error: any) {
        console.error(`Error previewing vault ${contractId}:`, error);
        return {
            success: false,
            error: error.message || 'An unexpected error occurred',
            requiresManualInput: false
        };
    }
}

// STEP 2: Confirm and save the vault after preview
// Keep the function, but remove export. It's now a local helper for addVault.
async function confirmVault(
    contractId: string,
    lpToken: any,
    tokenA: any,
    tokenB: any
): Promise<{
    success: boolean;
    error?: string;
    vault?: Vault;
}> {
    try {
        console.log(`Confirming vault ${contractId} (called internally)`);

        // 1. Construct vault object manually
        console.log('Building vault manually from token data');
        const [contractAddress, contractName] = contractId.split('.');

        const vault: Vault = {
            type: 'POOL',
            protocol: 'CHARISMA',
            contractId,
            contractAddress,
            contractName,
            name: lpToken.name,
            symbol: lpToken.symbol,
            decimals: lpToken.decimals,
            identifier: lpToken.identifier || '',
            description: lpToken.description || "",
            image: lpToken.image || "",
            fee: lpToken.lpRebatePercent ? Math.floor((Number(lpToken.lpRebatePercent) / 100) * 1_000_000) : 0,
            externalPoolId: lpToken.externalPoolId || "",
            engineContractId: lpToken.engineContractId || "",
            tokenA,
            tokenB,
            reservesA: lpToken.reservesA || 0,
            reservesB: lpToken.reservesB || 0
        };

        // Validate required fields
        console.log('Validating vault data...');
        if (!vault.contractId || !vault.contractAddress || !vault.contractName) {
            return {
                success: false,
                error: `Invalid vault data: Missing contractId parts. Got: contractId=${vault.contractId}, address=${vault.contractAddress}, name=${vault.contractName}`
            };
        }

        // Log vault data for debugging
        console.log('Vault data to save:', {
            contractId: vault.contractId,
            name: vault.name,
            symbol: vault.symbol,
            tokenA: { name: vault.tokenA?.name, symbol: vault.tokenA?.symbol },
            tokenB: { name: vault.tokenB?.name, symbol: vault.tokenB?.symbol },
            reservesA: vault.reservesA,
            reservesB: vault.reservesB
        });

        // 2. Save vault
        console.log(`Saving vault to KV...`);
        try {
            const saved = await saveVaultData(vault);
            if (!saved) {
                return { success: false, error: 'Failed to save vault data' };
            }
        } catch (kvError: any) {
            console.error('KV storage error:', kvError);
            return {
                success: false,
                error: `KV storage error: ${kvError.message || 'Unknown KV error'}`
            };
        }

        // 3. Revalidate page to reflect the new vault
        revalidatePath('/');

        return { success: true, vault };
    } catch (error: any) {
        console.error(`Error confirming vault ${contractId}:`, error);
        return {
            success: false,
            error: error.message || 'An unexpected error occurred while saving the vault'
        };
    }
}

// Action to remove a vault
export async function removeVault(contractId: string) {
    if (process.env.NODE_ENV !== 'development') {
        return { success: false, error: 'Action only available in development.' };
    }
    if (!contractId) return { success: false, error: 'ContractId required.' };

    try {
        // 1. Remove from managed list
        const list = await getVaultIdsFromService();
        if (list.includes(contractId)) {
            await kv.set(VAULT_LIST_KEY, list.filter(id => id !== contractId));
        }

        // 2. Delete from cache
        const cacheKey = getCacheKey(contractId);
        await kv.del(cacheKey);

        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error(`Failed removing vault ${contractId}:`, error);
        return { success: false, error: error.message || 'Failed to remove vault' };
    }
}

// Get existing vault data
export async function getVault(contractId: string): Promise<Vault | null> {
    return await getVaultData(contractId);
}

// Get managed vault IDs 
export async function getVaultIds(): Promise<string[]> {
    return await getVaultIdsFromService();
}

// Helper to fetch STX balance
async function fetchStxBalance(address: string): Promise<number> {
    try {
        const response = await fetch(`https://api.hiro.so/extended/v1/address/${address}/stx`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.HIRO_API_KEY}`
            }
        });
        if (!response.ok) {
            throw new Error(`STX Balance API Error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return Number(data.balance || 0);
    } catch (error) {
        console.error(`Failed fetching STX balance for ${address}:`, error);
        return 0;
    }
}

// Fetch token balance
async function fetchTokenBalance(tokenContractId: string, address: string): Promise<number> {
    try {
        if (tokenContractId === '.stx') {
            return await fetchStxBalance(address);
        } else {
            const [addr, name] = tokenContractId.split('.');
            const balanceCV = await callReadOnlyFunction(addr, name, 'get-balance', [principalCV(address)]);
            return Number(balanceCV.value);
        }
    } catch (error) {
        console.error(`Failed fetching token balance for ${tokenContractId}:`, error);
        return 0;
    }
}

// Get total supply of LP tokens
async function fetchTotalSupply(vaultContractId: string): Promise<number> {
    try {
        const [addr, name] = vaultContractId.split('.');
        const supplyCV = await callReadOnlyFunction(addr, name, 'get-total-supply', []);
        return Number(supplyCV.value);
    } catch (error) {
        console.error(`Failed fetching total supply for ${vaultContractId}:`, error);
        return 0;
    }
}

// Fetch quote for adding or removing liquidity
async function fetchQuote(vaultContractId: string, amount: number, opcode: string): Promise<{ dx: number; dy: number; dk: number } | null> {
    try {
        const [addr, name] = vaultContractId.split('.');
        const quoteResultCV = await callReadOnlyFunction(
            addr, name, 'quote', [
            uintCV(amount),
            optionalCVOf(bufferFromHex(opcode))
        ]
        );
        return {
            dx: Number(quoteResultCV.value.dx.value),
            dy: Number(quoteResultCV.value.dy.value),
            dk: Number(quoteResultCV.value.dk.value)
        };
    } catch (error) {
        console.error(`Failed fetching quote for ${vaultContractId}:`, error);
        return null;
    }
}

// Server action to fetch add liquidity data (quote and total supply)
export async function getAddLiquidityQuoteAndSupply(vaultContractId: string, targetLpAmount: number) {
    try {
        // Fetch total supply and quote in parallel
        const [totalSupply, quote] = await Promise.all([
            fetchTotalSupply(vaultContractId),
            targetLpAmount > 0
                ? fetchQuote(vaultContractId, targetLpAmount, OP_ADD_LIQUIDITY)
                : Promise.resolve({ dx: 0, dy: 0, dk: 0 })
        ]);

        return {
            totalSupply,
            quote
        };
    } catch (error) {
        console.error("Error in getAddLiquidityQuoteAndSupply:", error);
        throw new Error("Failed to fetch add liquidity quote and supply");
    }
}

// Server action to fetch remove liquidity data (quote only)
export async function getRemoveLiquidityQuote(vaultContractId: string, targetLpAmountToBurn: number) {
    try {
        // Get quote if we have a valid LP amount
        const quote = targetLpAmountToBurn > 0
            ? await fetchQuote(vaultContractId, targetLpAmountToBurn, OP_REMOVE_LIQUIDITY)
            : { dx: 0, dy: 0, dk: 0 };

        return {
            quote
        };
    } catch (error) {
        console.error("Error in getRemoveLiquidityQuote:", error);
        throw new Error("Failed to fetch remove liquidity quote");
    }
}

// Server action to fetch swap quote
export async function getSwapQuote(
    vaultContractId: string,
    amount: number,
    isAToB: boolean
) {
    try {
        // Determine the correct operation based on direction
        const operationCode = isAToB ? OP_SWAP_A_TO_B : OP_SWAP_B_TO_A;

        // Get quote for the swap
        const quote = await fetchQuote(vaultContractId, amount, operationCode);

        if (!quote) {
            throw new Error("Failed to fetch swap quote");
        }

        return {
            quote,
            // Include which token is input and which is output
            direction: {
                inputToken: isAToB ? 'A' : 'B',
                outputToken: isAToB ? 'B' : 'A'
            }
        };
    } catch (error) {
        console.error("Error in getSwapQuote:", error);
        throw new Error("Failed to fetch swap quote");
    }
}

// Convenience wrapper for A to B swap
export async function getSwapAToB(vaultContractId: string, amountA: number) {
    return getSwapQuote(vaultContractId, amountA, true);
}

// Convenience wrapper for B to A swap
export async function getSwapBToA(vaultContractId: string, amountB: number) {
    return getSwapQuote(vaultContractId, amountB, false);
}

// New action to fetch specific tokens and analyze, used after manual input
export async function fetchTokensAndAnalyze(
    lpToken: any, // Original LP token data, used for analysis context
    tokenAContractId: string,
    tokenBContractId: string
): Promise<{
    success: boolean;
    tokenA?: any; // The fetched Token A
    tokenB?: any; // The fetched Token B
    error?: string;
}> {
    if (!lpToken || !tokenAContractId || !tokenBContractId) {
        return { success: false, error: 'Missing required input for fetching tokens.' };
    }

    console.log(`Fetching manually provided tokens: A=${tokenAContractId}, B=${tokenBContractId}`);
    let tokenA: any;
    let tokenB: any;

    try {
        // 1. Fetch Token A metadata
        console.log(`Fetching Token A (${tokenAContractId})`);
        tokenA = await fetchTokenFromCache(tokenAContractId);
        if (!tokenA) {
            return {
                success: false,
                error: `Failed to fetch Token A (${tokenAContractId}) from token-cache.`
            };
        }

        // 2. Fetch Token B metadata
        console.log(`Fetching Token B (${tokenBContractId})`);
        tokenB = await fetchTokenFromCache(tokenBContractId);
        if (!tokenB) {
            return {
                success: false,
                tokenA, // Return A even if B failed
                error: `Failed to fetch Token B (${tokenBContractId}) from token-cache.`
            };
        }

        // Return fetched data directly
        return {
            success: true,
            tokenA, // Return fetched Token A
            tokenB, // Return fetched Token B
        };

    } catch (error: any) {
        console.error(`Error fetching/analyzing manual tokens:`, error);
        return {
            success: false,
            error: error.message || 'An unexpected error occurred during manual token fetch'
        };
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
            fetchTokenBalance(tokenAContractId, userAddress),
            fetchTokenBalance(tokenBContractId, userAddress),
            fetchTokenBalance(vaultContractId, userAddress), // LP token balance
            fetchTotalSupply(vaultContractId)
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

/**
 * Server action to fetch the user's LP token balance for a specific vault.
 */
export async function getLpTokenBalance(
    vaultContractId: string,
    userAddress: string
): Promise<{ success: boolean; balance?: number; error?: string }> {
    try {
        console.log(`[Server Action] Fetching LP balance for ${vaultContractId} / ${userAddress}`);
        const balance = await fetchTokenBalance(vaultContractId, userAddress);
        console.log(`[Server Action] LP Balance fetched: ${balance}`);
        return {
            success: true,
            balance
        };
    } catch (error) {
        console.error(`Error in getLpTokenBalance for ${vaultContractId} / ${userAddress}:`, error);
        return {
            success: false,
            error: "Failed to fetch LP token balance."
        };
    }
}

export async function fetchContractInfo(contractId: string) {
    const contractInfo = await getContractInfo(contractId);
    return contractInfo;
}