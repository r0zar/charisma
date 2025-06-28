import { kv } from "@vercel/kv";
import { callReadOnlyFunction, getContractInfo } from '@repo/polyglot';
import { principalCV, cvToValue, ClarityType, uintCV, bufferCVFromString, optionalCVOf } from '@stacks/transactions';
import { bufferFromHex } from "@stacks/transactions/dist/cl";
import { OPCODES, opcodeCV } from "dexterity-sdk";

/**
 * Basic token information
 */
export interface Token {
    contractId: string;
    identifier?: string;
    name: string;
    symbol: string;
    decimals: number;
    supply?: number;
    image?: string;
    description?: string;
    isLpToken?: boolean; // Flag to identify LP tokens
}

/**
 * Vault instance representing a liquidity pool or other vault type
 */
export interface Vault {
    type: string;
    protocol: string;
    contractId: string;
    contractAddress: string;
    contractName: string;
    name: string;
    symbol: string;
    decimals: number;
    identifier: string;
    description: string;
    image: string;
    fee: number;
    externalPoolId: string;
    engineContractId: string;
    base?: string;                 // Base token contract for ENERGY type vaults
    tokenA?: Token;                // Made optional to support non-LP token vaults
    tokenB?: Token;                // Made optional to support non-LP token vaults
    tokenBContract?: string;       // Contract ID of the subnet token for sublinks
    reservesA?: number;            // Made optional to support non-LP token vaults
    reservesB?: number;            // Made optional to support non-LP token vaults
    additionalData?: Record<string, any>; // Additional vault-specific data
}

// Cache constants
export const VAULT_CACHE_KEY_PREFIX = "dex-vault:"; // New prefix constant
export const VAULT_BLACKLIST_KEY = "vault-blacklist:dex"; // Blacklist key for vaults
const RESERVE_CACHE_DURATION_MS = 30 * 1000; // 30 seconds
const PRICING_RESERVE_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes for pricing calculations
const MIN_RESERVE_VALUE_TO_BE_VALID = 1; // Minimum value for a reserve to be considered valid

// Define an extended Vault type for internal use with timestamp
type CachedVault = Vault & { reservesLastUpdatedAt?: number };

// Helper to get the list of managed vault IDs
export const getManagedVaultIds = async (): Promise<string[]> => {
    try {
        const keys = await kv.keys(`${VAULT_CACHE_KEY_PREFIX}*`);
        // Extract contractId from each key. e.g., "dex-vault:SP..." -> "SP..."
        return keys.map(key => key.substring(VAULT_CACHE_KEY_PREFIX.length));
    } catch (error) {
        console.error(`Error fetching vault keys from KV with prefix ${VAULT_CACHE_KEY_PREFIX}:`, error);
        return [];
    }
};

/**
 * Fetches the list of blacklisted vault contract IDs from Vercel KV.
 * @returns A promise resolving to an array of blacklisted contract ID strings.
 */
export const getBlacklistedVaultIds = async (): Promise<string[]> => {
    try {
        const blacklistedIds = await kv.get<string[]>(VAULT_BLACKLIST_KEY);
        return Array.isArray(blacklistedIds) ? blacklistedIds : [];
    } catch (error) {
        console.error(`Error fetching vault blacklist from KV (${VAULT_BLACKLIST_KEY}):`, error);
        return [];
    }
};

/**
 * Adds a vault contract ID to the blacklist and removes it from cache.
 * @param contractId - The vault contract ID to blacklist.
 * @returns Success status and message.
 */
export const addVaultToBlacklist = async (contractId: string): Promise<{ success: boolean; message: string }> => {
    if (!contractId) {
        return { success: false, message: 'Contract ID is required' };
    }

    try {
        // Get current blacklist
        const currentBlacklist = await getBlacklistedVaultIds();

        // Add to blacklist if not already present
        if (!currentBlacklist.includes(contractId)) {
            const newBlacklist = [...currentBlacklist, contractId];
            await kv.set(VAULT_BLACKLIST_KEY, newBlacklist);
            console.log(`Added ${contractId} to vault blacklist`);
        }

        // Remove cached data
        const cacheKey = getCacheKey(contractId);
        await kv.del(cacheKey);
        console.log(`Removed cached data for vault ${contractId}`);

        return { success: true, message: `Successfully blacklisted vault ${contractId}` };
    } catch (error) {
        console.error(`Failed to blacklist vault ${contractId}:`, error);
        return { success: false, message: `Failed to blacklist vault: ${error}` };
    }
};

/**
 * Removes a vault contract ID from the blacklist.
 * @param contractId - The vault contract ID to remove from blacklist.
 * @returns Success status and message.
 */
export const removeVaultFromBlacklist = async (contractId: string): Promise<{ success: boolean; message: string }> => {
    if (!contractId) {
        return { success: false, message: 'Contract ID is required' };
    }

    try {
        const currentBlacklist = await getBlacklistedVaultIds();

        if (!currentBlacklist.includes(contractId)) {
            return { success: false, message: 'Vault not found in blacklist' };
        }

        const newBlacklist = currentBlacklist.filter(id => id !== contractId);
        await kv.set(VAULT_BLACKLIST_KEY, newBlacklist);
        console.log(`Removed ${contractId} from vault blacklist`);

        return { success: true, message: `Successfully removed ${contractId} from blacklist` };
    } catch (error) {
        console.error(`Failed to remove ${contractId} from vault blacklist:`, error);
        return { success: false, message: `Failed to remove from blacklist: ${error}` };
    }
};

/**
 * Checks if a vault contract ID is blacklisted.
 * @param contractId - The vault contract ID to check.
 * @returns True if blacklisted, false otherwise.
 */
export const isVaultBlacklisted = async (contractId: string): Promise<boolean> => {
    try {
        const blacklistedIds = await getBlacklistedVaultIds();
        return blacklistedIds.includes(contractId);
    } catch (error) {
        console.error(`Error checking vault blacklist status for ${contractId}:`, error);
        return false; // Default to not blacklisted on error
    }
};

// Cache key builder for individual vault objects
export const getCacheKey = (contractId: string): string => `${VAULT_CACHE_KEY_PREFIX}${contractId}`;


// Helper to fetch and update reserves, trying primary then backup method
async function fetchAndUpdateReserves(cachedVault: CachedVault, forPricing = false): Promise<CachedVault> {
    const now = Date.now();
    const cacheDuration = forPricing ? PRICING_RESERVE_CACHE_DURATION_MS : RESERVE_CACHE_DURATION_MS;

    if (cachedVault.reservesLastUpdatedAt &&
        (now - cachedVault.reservesLastUpdatedAt < cacheDuration) &&
        (cachedVault.reservesA !== undefined && cachedVault.reservesA >= MIN_RESERVE_VALUE_TO_BE_VALID && cachedVault.reservesB !== undefined && cachedVault.reservesB >= MIN_RESERVE_VALUE_TO_BE_VALID)
    ) {
        cachedVault.reservesA = Number(cachedVault.reservesA || 0);
        cachedVault.reservesB = Number(cachedVault.reservesB || 0);
        return cachedVault;
    }

    // For pricing calculations, don't make on-chain calls - use cached data even if stale
    if (forPricing) {
        console.log(`[PoolService] Using potentially stale reserve data for pricing: ${cachedVault.contractId}`);
        cachedVault.reservesA = Number(cachedVault.reservesA || 0);
        cachedVault.reservesB = Number(cachedVault.reservesB || 0);
        return cachedVault;
    }

    // Only attempt to update reserves if we have tokenA and tokenB
    if (!cachedVault.tokenA || !cachedVault.tokenB) {
        console.log(`Skipping reserve update for ${cachedVault.contractId}: tokenA or tokenB missing`);
        return cachedVault;
    }

    const contractId = cachedVault.contractId;
    const [contractAddress, contractName] = contractId.split('.');
    let reservesUpdated = false;
    let primaryError: Error | null = null;

    console.log(`[PoolService] Attempting to refresh reserves for ${contractId} if older than 30s or invalid...`);

    // 1. Primary attempt: get-reserves-quote
    if (cachedVault.type === 'POOL') {
        try {
            const reservesResult = await callReadOnlyFunction(
                contractAddress, contractName,
                'quote',
                [uintCV(0), opcodeCV(OPCODES.LOOKUP_RESERVES)]
            );

            // Using dx/dy as fallback if reserve-a/reserve-b not present
            const dxValue = reservesResult?.value?.dx?.value;
            const dyValue = reservesResult?.value?.dy?.value;

            const liveReservesA = dxValue !== null ? Number(dxValue) : (dyValue !== undefined ? Number(dyValue) : null);
            const liveReservesB = dyValue !== null ? Number(dyValue) : (dxValue !== undefined ? Number(dxValue) : null);

            if (liveReservesA !== null && liveReservesB !== null && !isNaN(liveReservesA) && !isNaN(liveReservesB) && liveReservesA > 0 && liveReservesB > 0) {
                cachedVault.reservesA = liveReservesA;
                cachedVault.reservesB = liveReservesB;
                cachedVault.reservesLastUpdatedAt = now;
                reservesUpdated = true;
            } else {
                console.warn(`Invalid or incomplete reserves structure from quote for ${contractId}:`, reservesResult);
                // Set error to indicate primary method failed structurally, even if no exception was thrown
                primaryError = new Error("Invalid structure from get-reserves-quote");
            }
        } catch (error) {
            primaryError = error instanceof Error ? error : new Error(String(error));
            console.warn(`Primary reserve fetch (quote) failed for ${contractId}:`, primaryError.message);
        }
    }

    // 2. Backup attempt: get-balance or STX balance (only if primary failed)
    if (!reservesUpdated) {
        console.warn(`Primary reserve fetch failed for ${contractId}. Attempting backup method...`);

        const isTokenAStx = cachedVault.tokenA?.contractId === '.stx';
        const isTokenBStx = cachedVault.tokenB?.contractId === '.stx';

        if (!cachedVault.tokenA?.contractId || !cachedVault.tokenB?.contractId) {
            console.error(`Cannot use backup method for ${contractId}: Missing token contract IDs.`);
        } else {
            try {
                let backupReservesA: number | null = null;
                let backupReservesB: number | null = null;

                const vaultPrincipalAddress = cachedVault.externalPoolId || contractId; // The vault's principal address IS its contractId

                // --- Fetch Backup Reserve A ---
                if (isTokenAStx) {
                    try {
                        const response = await fetch(`https://api.hiro.so/extended/v1/address/${vaultPrincipalAddress}/stx`);
                        if (!response.ok) {
                            throw new Error(`STX Balance API Error: ${response.status} ${response.statusText}`);
                        }
                        const data = await response.json();
                        backupReservesA = data.balance ? Number(data.balance) : null;
                        if (backupReservesA === null || isNaN(backupReservesA)) {
                            console.error(`Invalid STX balance data received for ${vaultPrincipalAddress}:`, data);
                            backupReservesA = null;
                        }
                    } catch (stxError) {
                        console.error(`Failed fetching STX balance (Token A) for ${vaultPrincipalAddress}:`, stxError);
                        backupReservesA = null;
                    }
                } else {
                    const [tokenAAddr, tokenAName] = cachedVault.tokenA.contractId.split('.');
                    const balanceAResultCV = await callReadOnlyFunction(
                        tokenAAddr, tokenAName, 'get-balance', [principalCV(vaultPrincipalAddress)]
                    );
                    // Revert to simpler parsing as requested
                    const balanceAValue = balanceAResultCV?.value; // Assuming .value holds the direct balance
                    backupReservesA = balanceAValue !== undefined && balanceAValue !== null && !isNaN(Number(balanceAValue)) ? Number(balanceAValue) : null;
                    if (backupReservesA === null) {
                        // Keep the error log, but adjust message slightly
                        console.error(`Failed fetching SIP10 balance (Token A) or invalid value for ${cachedVault.tokenA.contractId} held by ${vaultPrincipalAddress}. Raw Result:`, balanceAResultCV);
                    }
                }

                // --- Fetch Backup Reserve B ---
                if (isTokenBStx) {
                    try {
                        const response = await fetch(`https://api.hiro.so/extended/v1/address/${vaultPrincipalAddress}/stx`);
                        if (!response.ok) {
                            throw new Error(`STX Balance API Error: ${response.status} ${response.statusText}`);
                        }
                        const data = await response.json();
                        backupReservesB = data.balance ? Number(data.balance) : null;
                        if (backupReservesB === null || isNaN(backupReservesB)) {
                            console.error(`Invalid STX balance data received for ${vaultPrincipalAddress}:`, data);
                            backupReservesB = null;
                        }
                    } catch (stxError) {
                        console.error(`Failed fetching STX balance (Token B) for ${vaultPrincipalAddress}:`, stxError);
                        backupReservesB = null;
                    }
                } else {
                    const [tokenBAddr, tokenBName] = cachedVault.tokenB.contractId.split('.');
                    const balanceBResultCV = await callReadOnlyFunction(
                        tokenBAddr, tokenBName, 'get-balance', [principalCV(vaultPrincipalAddress)]
                    );
                    // Revert to simpler parsing as requested
                    const balanceBValue = balanceBResultCV?.value; // Assuming .value holds the direct balance
                    backupReservesB = balanceBValue !== undefined && balanceBValue !== null && !isNaN(Number(balanceBValue)) ? Number(balanceBValue) : null;
                    if (backupReservesB === null) {
                        // Keep the error log, but adjust message slightly
                        console.error(`Failed fetching SIP10 balance (Token B) or invalid value for ${cachedVault.tokenB.contractId} held by ${vaultPrincipalAddress}. Raw Result:`, balanceBResultCV);
                    }
                }

                // --- Update Vault if successful ---
                if (backupReservesA !== null && backupReservesB !== null) {
                    cachedVault.reservesA = backupReservesA;
                    cachedVault.reservesB = backupReservesB;
                    cachedVault.reservesLastUpdatedAt = now;
                    reservesUpdated = true;
                } else {
                    console.error(`Backup reserve fetch failed for ${contractId}: One or both balances could not be determined.`);
                }

            } catch (backupError) {
                // Catch errors from splitting contract IDs or other unexpected issues
                console.error(`Unexpected error during backup reserve fetch for ${contractId}:`, backupError);
                if (primaryError) {
                    console.error(`Primary fetch also failed: ${primaryError.message}`);
                }
            }
        }
    }

    // 3. Finalize: Ensure reserves are numbers and return
    if (cachedVault.reservesA) {
        cachedVault.reservesA = Number(cachedVault.reservesA || 0);
    }
    if (cachedVault.reservesB) {
        cachedVault.reservesB = Number(cachedVault.reservesB || 0);
    }

    if (!reservesUpdated) {
        console.warn(`Failed to update reserves for ${contractId} using both methods. Returning potentially stale data.`);
    }

    return cachedVault;
}

// Read a vault from KV cache, revalidating reserves periodically
export const getVaultData = async (contractId: string): Promise<Vault | null> => {
    const isSpecialToken = contractId === '.stx';
    if (!contractId || (!isSpecialToken && !contractId.includes('.'))) {
        console.warn(`[PoolService] Invalid contractId format for getVaultData: ${contractId}`);
        return null;
    }

    // Check if vault is blacklisted
    if (await isVaultBlacklisted(contractId)) {
        console.log(`Vault ${contractId} is blacklisted, returning null`);
        return null;
    }

    const cacheKey = getCacheKey(contractId);

    try {
        const rawCachedData = await kv.get<string | CachedVault>(cacheKey);
        let cachedVault: CachedVault | null = null;

        if (typeof rawCachedData === 'string') {
            try {
                cachedVault = JSON.parse(rawCachedData) as CachedVault;
            } catch (parseError) {
                console.error(`[getVaultData] Failed to parse cached data for ${contractId}:`, parseError);
                return null; // If parsing fails, treat as not found or invalid
            }
        } else if (typeof rawCachedData === 'object' && rawCachedData !== null) {
            cachedVault = rawCachedData as CachedVault;
        } else {
            return null; // Not found in KV
        }

        if (!cachedVault) {
            console.warn(`[PoolService] Vault data is null after attempting to read from KV for ${cacheKey}.`);
            return null;
        }

        // Only return cached data - no on-chain calls for pricing
        cachedVault.reservesA = Number(cachedVault.reservesA || 0);
        cachedVault.reservesB = Number(cachedVault.reservesB || 0);
        return cachedVault;

    } catch (error) {
        console.error(`[getVaultData] Error processing for ${contractId}:`, error);
        return null;
    }
};

/**
 * Get vault data WITH reserve updates (for cron jobs only)
 * This function makes on-chain calls and should only be used by background processes
 */
export const getVaultDataWithReserveUpdate = async (contractId: string): Promise<Vault | null> => {
    const isSpecialToken = contractId === '.stx';
    if (!contractId || (!isSpecialToken && !contractId.includes('.'))) {
        console.warn(`[PoolService] Invalid contractId format for getVaultDataWithReserveUpdate: ${contractId}`);
        return null;
    }

    // Check if vault is blacklisted
    if (await isVaultBlacklisted(contractId)) {
        console.log(`Vault ${contractId} is blacklisted, returning null`);
        return null;
    }

    const cacheKey = getCacheKey(contractId);

    try {
        const rawCachedData = await kv.get<string | CachedVault>(cacheKey);
        let cachedVault: CachedVault | null = null;

        if (typeof rawCachedData === 'string') {
            try {
                cachedVault = JSON.parse(rawCachedData) as CachedVault;
            } catch (parseError) {
                console.error(`[getVaultDataWithReserveUpdate] Failed to parse cached data for ${contractId}:`, parseError);
                return null;
            }
        } else if (typeof rawCachedData === 'object' && rawCachedData !== null) {
            cachedVault = rawCachedData as CachedVault;
        } else {
            console.log(`[getVaultDataWithReserveUpdate] No cached data found for ${contractId}`);
            return null;
        }

        if (!cachedVault) {
            console.warn(`[PoolService] Vault data is null for ${contractId}`);
            return null;
        }

        // Update reserves if it's a pool/sublink
        if ((cachedVault.type === 'POOL' || cachedVault.type === 'SUBLINK') && cachedVault.tokenA && cachedVault.tokenB) {
            const updatedVault = await fetchAndUpdateReserves(cachedVault, false);
            // Save updated data back to cache
            await saveVaultData(updatedVault);
            return updatedVault;
        } else {
            console.log(`[PoolService] Returning vault ${contractId} without reserve refresh (type: ${cachedVault.type})`);
            return cachedVault;
        }

    } catch (error) {
        console.error(`[getVaultDataWithReserveUpdate] Error processing for ${contractId}:`, error);
        return null;
    }
};

// Save vault to KV cache (accepts extended type)
export const saveVaultData = async (vault: CachedVault): Promise<boolean> => { // Accept extended type
    if (!vault || !vault.contractId) {
        console.error("Cannot save vault: missing contractId");
        return false;
    }
    try {
        const cacheKey = getCacheKey(vault.contractId);

        // Fetch existing cached data to preserve fields if needed
        let existing: CachedVault | null = null;
        try {
            const raw = await kv.get<string | CachedVault>(cacheKey);
            if (typeof raw === 'string') {
                existing = JSON.parse(raw) as CachedVault;
            } else if (typeof raw === 'object' && raw !== null) {
                existing = raw as CachedVault;
            }
        } catch (e) {
            // Ignore cache miss or parse error, existing will remain null
            console.warn(`Could not retrieve or parse existing cache for ${cacheKey}:`, e);
        }

        let finalType = vault.type; // Start with the type from the incoming vault data

        // If the incoming vault's type is 'POOL' (potentially a default)
        // and an existing vault had a more specific type (not 'POOL' and not undefined),
        // then prefer the existing specific type.
        if (vault.type === 'POOL' && existing?.type && existing.type !== 'POOL') {
            finalType = existing.type;
        } else if (!vault.type && existing?.type) {
            // If incoming vault has no type, but existing did, use existing.
            finalType = existing.type;
        }
        // If finalType is still undefined (neither vault.type nor existing.type provided one, or vault.type was 'POOL' and existing.type was also 'POOL' or undefined),
        // it will be defaulted to 'POOL' below.

        const vaultToSave: CachedVault = {
            ...(existing || {}), // Spread existing first to have a base, use empty object if existing is null
            ...vault,            // Spread new vault data, this will overwrite fields from existing if they are in vault
            type: finalType || 'POOL', // Apply the determined type, defaulting to 'POOL' if still undefined
            protocol: vault.protocol ?? existing?.protocol ?? 'CHARISMA',
            // reservesLastUpdatedAt will be correctly taken from `...vault`
            // as it's initialized in buildVaultStructureFromTokens and updated in fetchAndUpdateReserves
        };

        // Make sure reserves are numbers if present
        if (vaultToSave.reservesA !== undefined) {
            vaultToSave.reservesA = Number(vaultToSave.reservesA || 0);
        }
        if (vaultToSave.reservesB !== undefined) {
            vaultToSave.reservesB = Number(vaultToSave.reservesB || 0);
        }

        try {
            await kv.set(cacheKey, vaultToSave);
        } catch (setError) {
            console.error('Error during KV.set operation:', setError);
            throw new Error(`KV.set failed: ${setError instanceof Error ? setError.message : 'Unknown error'}`);
        }

        return true;
    } catch (error) {
        console.error(`Error saving vault ${vault.contractId}:`, error);
        return false;
    }
};

/**
 * Update reserves for all CHARISMA pools (for cron jobs only)
 * This function makes on-chain calls and should only be used by background processes
 */
export const updateAllPoolReserves = async (): Promise<{ updated: number; errors: number }> => {
    console.log('[PoolService] Starting bulk reserve update for CHARISMA pools...');
    const startTime = Date.now();

    try {
        const [vaultIds, blacklistedIds] = await Promise.all([
            getManagedVaultIds(),
            getBlacklistedVaultIds()
        ]);

        const validVaultIds = vaultIds.filter(id => !blacklistedIds.includes(id));
        console.log(`[PoolService] Updating reserves for ${validVaultIds.length} vaults`);

        let updated = 0;
        let errors = 0;

        // Process in smaller batches to avoid overwhelming the system
        const batchSize = 5;
        for (let i = 0; i < validVaultIds.length; i += batchSize) {
            const batch = validVaultIds.slice(i, i + batchSize);

            const promises = batch.map(async (vaultId) => {
                try {
                    const vault = await getVaultDataWithReserveUpdate(vaultId);
                    if (vault && (vault.type === 'POOL' || vault.type === 'SUBLINK') && vault.protocol === 'CHARISMA') {
                        updated++;
                        console.log(`[PoolService] Updated reserves for ${vault.symbol} (${vaultId})`);
                    }
                } catch (error) {
                    errors++;
                    console.error(`[PoolService] Failed to update reserves for ${vaultId}:`, error);
                }
            });

            await Promise.all(promises);

            // Small delay between batches
            if (i + batchSize < validVaultIds.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const duration = Date.now() - startTime;
        console.log(`[PoolService] Bulk reserve update completed in ${duration}ms: ${updated} updated, ${errors} errors`);

        return { updated, errors };
    } catch (error) {
        console.error('[PoolService] Failed to update pool reserves:', error);
        return { updated: 0, errors: 1 };
    }
};

// Get all vault data from KV
export const getAllVaultData = async ({ protocol, type }: { protocol?: string, type?: string } = {}): Promise<Vault[]> => {
    try {
        const [vaultIds, blacklistedIds] = await Promise.all([
            getManagedVaultIds(),
            getBlacklistedVaultIds()
        ]);

        // Filter out blacklisted vaults
        const validVaultIds = vaultIds.filter(id => !blacklistedIds.includes(id));

        if (!validVaultIds.length) {
            console.log('No valid (non-blacklisted) vaults found');
            return [];
        }

        console.log(`Fetching ${validVaultIds.length} vaults from cache (${vaultIds.length - validVaultIds.length} blacklisted)`);
        const vaultPromises = validVaultIds.map(id => getVaultData(id));
        const results = await Promise.all(vaultPromises);
        const vaults = results.filter((v: Vault | null): v is Vault => v !== null);

        // Filter by protocol if provided
        if (protocol) {
            return vaults.filter(vault => vault.protocol?.toLowerCase() === protocol.toLowerCase());
        }
        if (type) {
            return vaults.filter(vault => vault.type === type);
        }
        return vaults;
    } catch (error) {
        console.error('Error fetching all vaults:', error);
        return [];
    }
};

// Utility to remove vaults from the managed list and delete their cache
export const removeVaults = async (vaultIds: string[]): Promise<void> => {
    if (!vaultIds.length) return;
    try {
        // Delete individual cache entries
        const deletePromises = vaultIds.map(id => {
            const cacheKey = getCacheKey(id);
            return kv.del(cacheKey).then(() => {
                console.log(`Deleted vault cache for ${id}`);
            }).catch(err => {
                console.error(`Error deleting cache for ${id}:`, err);
            });
        });
        await Promise.all(deletePromises);

    } catch (error) {
        console.error('Error removing vaults:', error);
    }
};

export const listVaultTokens = async (): Promise<Token[]> => {
    const vaults = await getAllVaultData();
    const tokenMap = new Map<string, Token>(); // Key: contractId, Value: Token object

    const filteredVaults = vaults.filter(v =>
        (v.type === 'POOL' || v.type === 'SUBLINK') &&
        v.protocol === 'CHARISMA'
    );

    for (const vault of filteredVaults) {
        // Process tokenA if it exists
        if (vault.tokenA && vault.tokenA.contractId) { // Ensure token and contractId exist
            if (!tokenMap.has(vault.tokenA.contractId)) {
                tokenMap.set(vault.tokenA.contractId, {
                    ...vault.tokenA,
                    isLpToken: false // Regular tokens are not LP tokens
                });
            }
        }
        // Process tokenB if it exists
        if (vault.tokenB && vault.tokenB.contractId) { // Ensure token and contractId exist
            if (!tokenMap.has(vault.tokenB.contractId)) {
                tokenMap.set(vault.tokenB.contractId, {
                    ...vault.tokenB,
                    isLpToken: false // Regular tokens are not LP tokens
                });
            }
        }
    }
    return Array.from(tokenMap.values());
}

export const listVaults = async (): Promise<Vault[]> => {
    return await getAllVaultData({
        protocol: 'CHARISMA',
        type: 'POOL'
    });
}

// --- Added functions from actions.ts logic ---

async function _fetchStxBalance(address: string): Promise<number> {
    try {
        // Assuming HIRO_API_KEY might be needed for rate limiting / auth in future,
        // but current actions.ts implementation doesn't use it for this specific call.
        // Adapting to use environment variable if available, like in actions.ts getLpTokenBalance example.
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (process.env.HIRO_API_KEY) {
            headers['Authorization'] = `Bearer ${process.env.HIRO_API_KEY}`;
        }
        const response = await fetch(`https://api.hiro.so/extended/v1/address/${address}/stx`, { headers });
        if (!response.ok) {
            throw new Error(`STX Balance API Error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return Number(data.balance || 0);
    } catch (error) {
        console.error(`[vaultService] Failed fetching STX balance for ${address}:`, error);
        return 0; // Consistent error handling with actions.ts
    }
}

async function _fetchSip10Balance(contractAddress: string, contractName: string, userPrincipal: string): Promise<number> {
    try {
        const balanceCV = await callReadOnlyFunction(contractAddress, contractName, 'get-balance', [principalCV(userPrincipal)]);
        // Assuming balanceCV.value directly holds the number or can be converted
        return Number(balanceCV?.value || 0);
    } catch (error) {
        console.error(`[vaultService] Failed fetching SIP10 balance for ${contractAddress}.${contractName} for user ${userPrincipal}:`, error);
        return 0;
    }
}

export async function getFungibleTokenBalance(tokenContractId: string, userAddress: string): Promise<number> {
    try {
        if (tokenContractId === '.stx') {
            return await _fetchStxBalance(userAddress);
        } else {
            const [addr, name] = tokenContractId.split('.');
            if (!addr || !name) {
                throw new Error(`Invalid SIP-10 token contract ID: ${tokenContractId}`);
            }
            return await _fetchSip10Balance(addr, name, userAddress);
        }
    } catch (error) {
        console.error(`[vaultService] Error in getFungibleTokenBalance for ${tokenContractId} and user ${userAddress}:`, error);
        return 0; // Default to 0 on error
    }
}

export async function getLpTokenTotalSupply(vaultContractId: string): Promise<number> {
    try {
        const [addr, name] = vaultContractId.split('.');
        if (!addr || !name) {
            throw new Error(`Invalid vault contract ID for total supply: ${vaultContractId}`);
        }
        const supplyCV = await callReadOnlyFunction(addr, name, 'get-total-supply', []);
        return Number(supplyCV?.value || 0);
    } catch (error) {
        console.error(`[vaultService] Failed fetching total supply for ${vaultContractId}:`, error);
        return 0;
    }
}

export async function getLiquidityOperationQuote(
    vaultContractId: string,
    amount: number,
    operationHex: string // e.g. OP_ADD_LIQUIDITY from lib/utils.ts
): Promise<{ dx: number; dy: number; dk: number } | null> {
    try {
        const [addr, name] = vaultContractId.split('.');
        if (!addr || !name) {
            throw new Error(`Invalid vault contract ID for quote: ${vaultContractId}`);
        }
        const quoteResultCV = await callReadOnlyFunction(
            addr, name, 'quote', [
            uintCV(amount),
            // The 'quote' function in the example contract might expect (optional (buff 1))
            // Ensuring we use bufferFromHex for the opcode.
            optionalCVOf(bufferFromHex(operationHex))
        ]
        );
        const quoteValue = quoteResultCV?.value;
        if (quoteValue && quoteValue.dx !== undefined && quoteValue.dy !== undefined && quoteValue.dk !== undefined) {
            return {
                dx: Number(quoteValue.dx.value),
                dy: Number(quoteValue.dy.value),
                dk: Number(quoteValue.dk.value)
            };
        }
        console.warn(`[vaultService] Invalid quote structure for ${vaultContractId} with op ${operationHex}:`, quoteValue);
        return null;
    } catch (error) {
        console.error(`[vaultService] Failed fetching quote for ${vaultContractId} with op ${operationHex}:`, error);
        return null;
    }
}

/**
 * Fetches detailed contract information, including source code.
 * Uses getContractInfo from @repo/polyglot.
 */
export async function getContractSourceDetails(contractId: string): Promise<any> {
    try {
        const [contractAddress, contractName] = contractId.split('.');
        if (!contractAddress || !contractName) {
            throw new Error(`Invalid contract ID for source details: ${contractId}`);
        }
        const contractInfo = await getContractInfo(contractId);
        return contractInfo;
    } catch (error) {
        console.error(`[vaultService] Failed to get contract source details for ${contractId}:`, error);
        return null;
    }
}

/**
 * LP Token Helper Functions
 * These functions support LP token pricing analysis and calculations
 */

/**
 * Check if a vault represents an LP token (has both tokenA and tokenB, or is marked as type POOL)
 * @param vault - The vault to check
 * @returns True if the vault is an LP token
 */
export const isLpToken = (vault: Vault): boolean => {
    // Check for type = "POOL" first (covers newer and older LP tokens)
    if (vault.type === 'POOL') {
        return true;
    }
    // Fallback to legacy detection (has both tokenA and tokenB with reserves)
    return !!(vault.tokenA && vault.tokenB && vault.reservesA !== undefined && vault.reservesB !== undefined);
};

/**
 * Get the estimated total supply of LP tokens for a vault
 * Note: This is a simplified estimation. In production, this should query the actual contract
 * @param vault - The vault to calculate total supply for
 * @returns Estimated total supply or null if calculation not possible
 */
export const getEstimatedLpTokenSupply = (vault: Vault): number | null => {
    if (!isLpToken(vault) || !vault.reservesA || !vault.reservesB) {
        return null;
    }
    
    // Simplified estimation: sum of reserves
    // In reality, LP token supply is tracked separately by the contract
    return vault.reservesA + vault.reservesB;
};

/**
 * Calculate the pool share represented by a given amount of LP tokens
 * @param vault - The vault/pool
 * @param lpTokenAmount - Amount of LP tokens
 * @returns Pool share as a decimal (0.1 = 10%) or null if calculation not possible
 */
export const calculatePoolShare = (vault: Vault, lpTokenAmount: number): number | null => {
    const totalSupply = getEstimatedLpTokenSupply(vault);
    
    if (!totalSupply || totalSupply === 0) {
        return null;
    }
    
    return lpTokenAmount / totalSupply;
};

/**
 * Calculate the underlying token amounts for a given LP token amount
 * @param vault - The vault/pool
 * @param lpTokenAmount - Amount of LP tokens
 * @returns Object with tokenA and tokenB amounts, or null if calculation not possible
 */
export const calculateUnderlyingTokenAmounts = (
    vault: Vault, 
    lpTokenAmount: number
): { tokenA: number; tokenB: number } | null => {
    const poolShare = calculatePoolShare(vault, lpTokenAmount);
    
    if (!poolShare || !vault.reservesA || !vault.reservesB) {
        return null;
    }
    
    // Calculate token amounts in proper decimal representation
    const tokenADecimals = vault.tokenA?.decimals || 0;
    const tokenBDecimals = vault.tokenB?.decimals || 0;
    
    const tokenAInPool = vault.reservesA / Math.pow(10, tokenADecimals);
    const tokenBInPool = vault.reservesB / Math.pow(10, tokenBDecimals);
    
    return {
        tokenA: tokenAInPool * poolShare,
        tokenB: tokenBInPool * poolShare
    };
};

/**
 * Check if a vault contract ID might represent a tradable LP token
 * This is a heuristic check based on naming patterns
 * @param contractId - The contract ID to check
 * @returns True if the contract might be a tradable LP token
 */
export const mightBeTradableLpToken = (contractId: string): boolean => {
    const lowerCaseId = contractId.toLowerCase();
    
    // Common patterns for LP tokens
    const lpTokenPatterns = [
        'lp-token',
        'liquidity-token',
        'pool-token',
        '-lp-',
        '-pool-',
        'vault-wrapper'
    ];
    
    return lpTokenPatterns.some(pattern => lowerCaseId.includes(pattern));
};

/**
 * Get vault metadata for LP token pricing display
 * @param vault - The vault to get metadata for
 * @returns Formatted metadata object
 */
export const getLpTokenMetadata = (vault: Vault) => {
    return {
        name: vault.name || 'Unnamed LP Token',
        symbol: vault.symbol || 'LP',
        contractId: vault.contractId,
        isLpToken: isLpToken(vault),
        mightBeTradable: mightBeTradableLpToken(vault.contractId),
        tokenPair: vault.tokenA && vault.tokenB ? 
            `${vault.tokenA.symbol}-${vault.tokenB.symbol}` : 
            null,
        decimals: vault.decimals || 6
    };
};


// Example usage (uncomment to run once, then re-comment):
/*
removeVaults([
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-welsh-vault-wrapper-alex',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-cha-vault-wrapper-alex'
]);
*/
