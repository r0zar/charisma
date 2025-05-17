import { kv } from "@vercel/kv";
import { callReadOnlyFunction } from '@repo/polyglot';
import { principalCV, cvToValue, ClarityType } from '@stacks/transactions';

/**
 * Basic token information
 */
interface Token {
    contractId: string;
    identifier?: string;
    name: string;
    symbol: string;
    decimals: number;
    supply?: number;
    image?: string;
    description?: string;
    contract_principal?: string;
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
    tokenA?: Token;                // Made optional to support non-LP token vaults
    tokenB?: Token;                // Made optional to support non-LP token vaults
    tokenBContract?: string;       // Contract ID of the subnet token for sublinks
    reservesA?: number;            // Made optional to support non-LP token vaults
    reservesB?: number;            // Made optional to support non-LP token vaults
    additionalData?: Record<string, any>; // Additional vault-specific data
}

// Cache constants
const CACHE_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const VAULT_LIST_KEY = "vault-list:dex";
const RESERVE_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Define an extended Vault type for internal use with timestamp
type CachedVault = Vault & { reservesLastUpdatedAt?: number };

// Helper to get the list of managed vault IDs
export const getManagedVaultIds = async (): Promise<string[]> => {
    try {
        const ids = await kv.get<string[]>(VAULT_LIST_KEY);

        return Array.isArray(ids) ? ids : [];
    } catch (error) {
        console.error(`Error fetching vault list from KV (${VAULT_LIST_KEY}):`, error);
        return [];
    }
};

// Cache key builder for individual vault objects
export const getCacheKey = (contractId: string): string => `dex-vault:${contractId}`;

// Add a vault ID to the managed list (if not already present)
export const addVaultIdToManagedList = async (contractId: string): Promise<void> => {
    if (!contractId) return;
    try {
        const current = await getManagedVaultIds();
        if (!current.includes(contractId)) {
            await kv.set(VAULT_LIST_KEY, [...current, contractId]);
            console.log(`Added ${contractId} to managed vault list`);
        }
    } catch (error) {
        console.error(`Failed adding ${contractId} to managed vault list`, error);
    }
};

// Fetch token metadata from token-cache API (can be LP token or underlying token)
export const fetchTokenFromCache = async (contractId: string): Promise<any | null> => {
    // Special case for STX token
    if (contractId === '.stx') {
        console.log('Special case: STX token requested');
        return {
            contractId: '.stx',
            contract_principal: '.stx',
            name: 'Stacks',
            symbol: 'STX',
            decimals: 6,
            image: 'https://charisma.rocks/stx-logo.png',
            description: 'Native token of the Stacks blockchain',
            identifier: 'stx'
        };
    }

    const base = process.env.TOKEN_CACHE_ENDPOINT || 'http://localhost:3000'
    if (!base) {
        console.error("Token Cache endpoint/host not configured.");
        return null;
    }
    const url = `${base}/api/v1/sip10/${encodeURIComponent(contractId)}`;
    console.log(`Fetching token from cache: ${url}`);
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.warn(`Failed token cache fetch for ${contractId} (${res.status}): ${url}`);
            return null;
        }
        const json = await res.json();
        if (json?.status === 'success' && json?.data) {
            return json.data;
        } else {
            console.warn(`Token cache API returned non-success for ${contractId}: ${JSON.stringify(json)}`);
            return null;
        }
    } catch (err) {
        console.error(`Error fetching token ${contractId} from cache API: ${url}`, err);
        return null;
    }
};

// Helper function to build a vault structure from token metadata
// This is similar to parts of confirmVault, but doesn't save, just constructs
// It also doesn't rely on AI suggestions for this core path.
function buildVaultStructureFromTokens(
    contractId: string,
    lpToken: any,
    tokenA: any | null = null,
    tokenB: any | null = null
): CachedVault | null {
    try {
        const [contractAddress, contractName] = contractId.split('.');
        if (!contractAddress || !contractName) {
            console.error(`[buildVaultStructure] Invalid contractId format: ${contractId}`);
            return null;
        }
        if (!lpToken) {
            console.error(`[buildVaultStructure] Missing main token data for ${contractId}`);
            return null;
        }

        // Determine vault type - defaults to POOL if not specified
        const vaultType = lpToken.type?.toUpperCase() || 'POOL';

        // Basic validation of essential fields
        if (!lpToken.decimals && lpToken.decimals !== 0) {
            console.warn(`[buildVaultStructure] Missing decimals for ${contractId}, defaulting to 0`);
            lpToken.decimals = 0;
        }
        if (!lpToken.name) {
            console.warn(`[buildVaultStructure] Missing name for ${contractId}, using contractId`);
            lpToken.name = contractId;
        }
        if (!lpToken.symbol) {
            console.warn(`[buildVaultStructure] Missing symbol for ${contractId}, generating from contractName`);
            lpToken.symbol = contractName.toUpperCase();
        }

        // For POOL and SUBLINK types, tokens A and B are required
        if ((vaultType === 'POOL' || vaultType === 'SUBLINK') && (!tokenA || !tokenB)) {
            console.warn(`[buildVaultStructure] ${vaultType} type requires tokenA and tokenB, but one or both are missing`);
            // Instead of failing, we'll create the vault but mark it as potentially incomplete
            console.warn(`[buildVaultStructure] Creating incomplete vault structure for ${contractId}`);
        }

        // Calculate fee from lpRebatePercent if available
        let fee = 0;
        if (lpToken.fee) {
            fee = lpToken.fee;
        } else if (lpToken.lpRebatePercent) {
            fee = Math.floor((lpToken.lpRebatePercent / 100) * 1_000_000);
        } else if (lpToken.properties?.fee) {
            fee = lpToken.properties.fee;
        } else if (lpToken.properties?.lpRebatePercent) {
            fee = Math.floor((lpToken.properties.lpRebatePercent / 100) * 1_000_000);
        }

        // Build the vault structure
        const vault: CachedVault = {
            type: vaultType,
            protocol: lpToken.protocol || 'CHARISMA',
            contractId,
            contractAddress,
            contractName,
            name: lpToken.name,
            symbol: lpToken.symbol,
            decimals: lpToken.decimals,
            identifier: lpToken.identifier || '',
            description: lpToken.description || "",
            image: lpToken.image || "",
            fee,
            externalPoolId: lpToken.externalPoolId || (lpToken.properties?.externalPoolId) || "",
            engineContractId: lpToken.engineContractId || (lpToken.properties?.engineContractId) || "",
            tokenBContract: lpToken.tokenBContract || lpToken.properties?.tokenBContract || "",
            reservesLastUpdatedAt: 0 // Indicate reserves haven't been fetched yet
        };

        // Only add tokenA/tokenB if they exist
        if (tokenA) {
            vault.tokenA = tokenA;
            vault.reservesA = 0;
        }

        if (tokenB) {
            vault.tokenB = tokenB;
            vault.reservesB = 0;
        }

        // Add any additional data fields that may be present
        if (lpToken.additionalData) {
            vault.additionalData = lpToken.additionalData;
        }

        return vault;
    } catch (error) {
        console.error(`[buildVaultStructure] Error constructing vault for ${contractId}:`, error);
        return null;
    }
}

// Helper to fetch and update reserves, trying primary then backup method
async function fetchAndUpdateReserves(cachedVault: CachedVault): Promise<CachedVault> {
    // Only attempt to update reserves if we have tokenA and tokenB
    if (!cachedVault.tokenA || !cachedVault.tokenB) {
        console.log(`Skipping reserve update for ${cachedVault.contractId}: tokenA or tokenB missing`);
        return cachedVault;
    }

    const now = Date.now();
    const contractId = cachedVault.contractId;
    const [contractAddress, contractName] = contractId.split('.');
    let reservesUpdated = false;
    let primaryError: Error | null = null;

    console.log(`Attempting to refresh reserves for ${contractId}...`);

    // 1. Primary attempt: get-reserves-quote
    try {
        const reservesResult = await callReadOnlyFunction(
            contractAddress, contractName,
            'get-reserves-quote',
            []
        );

        // Using dx/dy as fallback if reserve-a/reserve-b not present
        const dxValue = reservesResult?.dx?.value;
        const dyValue = reservesResult?.dy?.value;

        const liveReservesA = dxValue !== null ? Number(dxValue) : (dyValue !== undefined ? Number(dyValue) : null);
        const liveReservesB = dyValue !== null ? Number(dyValue) : (dxValue !== undefined ? Number(dxValue) : null);


        if (liveReservesA !== null && liveReservesB !== null && !isNaN(liveReservesA) && !isNaN(liveReservesB) && liveReservesA > 0 && liveReservesB > 0) {
            cachedVault.reservesA = liveReservesA;
            cachedVault.reservesB = liveReservesB;
            cachedVault.reservesLastUpdatedAt = now;
            reservesUpdated = true;
        } else {
            console.warn(`Invalid or incomplete reserves structure from get-reserves-quote for ${contractId}:`, reservesResult);
            // Set error to indicate primary method failed structurally, even if no exception was thrown
            primaryError = new Error("Invalid structure from get-reserves-quote");
        }
    } catch (error) {
        primaryError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Primary reserve fetch (get-reserves-quote) failed for ${contractId}:`, primaryError.message);
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

                const vaultPrincipalAddress = contractId; // The vault's principal address IS its contractId

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
export const getVaultData = async (contractId: string, refresh: boolean = false): Promise<Vault | null> => {
    const isSpecialToken = contractId === '.stx';
    if (!contractId || (!isSpecialToken && !contractId.includes('.'))) {
        console.warn(`Invalid contractId format passed to getVaultData: ${contractId}`);
        return null;
    }
    const cacheKey = getCacheKey(contractId);

    try {
        // Attempt to get raw string data first for robust parsing
        console.log(cacheKey);
        const rawCachedData = await kv.get<string | CachedVault>(cacheKey);
        let cached: CachedVault | null = null;

        if (!refresh && typeof rawCachedData === 'string') { // Only parse if not forcing refresh
            try {
                cached = JSON.parse(rawCachedData) as CachedVault;
            } catch (parseError) {
                console.error(`Failed to parse cached data for ${contractId}:`, parseError);
                cached = null; // Treat as cache miss if parse fails
            }
        } else if (!refresh && typeof rawCachedData === 'object' && rawCachedData !== null) { // Only use if not forcing refresh
            cached = rawCachedData as CachedVault;
        }

        // --- Logic Branching ---

        // Branch 1: Cache Hit and No Refresh Requested
        if (cached && !refresh) {
            const now = Date.now();
            const lastUpdated = cached.reservesLastUpdatedAt || 0;
            const needsReserveRefresh = (now - lastUpdated) > RESERVE_REFRESH_INTERVAL_MS;

            // Only attempt reserve refresh for POOL and SUBLINK types
            const canRefreshReserves = (cached.type === 'POOL' || cached.type === 'SUBLINK') && cached.tokenA && cached.tokenB;

            if (needsReserveRefresh && canRefreshReserves) {
                console.log(`[Cache Hit - Stale] Vault ${contractId}. Refreshing reserves...`);
                const updatedCached = await fetchAndUpdateReserves(cached);
                // Asynchronously save back to cache
                saveVaultData(updatedCached).catch(saveErr => {
                    console.error(`Failed async save after stale refresh for ${contractId}:`, saveErr);
                });
                return updatedCached;
            } else {
                // Make sure reserves are numbers if present
                if (cached.reservesA !== undefined) {
                    cached.reservesA = Number(cached.reservesA || 0);
                }
                if (cached.reservesB !== undefined) {
                    cached.reservesB = Number(cached.reservesB || 0);
                }
                return cached;
            }
        }
        // Branch 2: Cache Miss OR Refresh Requested
        else {
            console.log(refresh ? `[Refresh Requested] Vault ${contractId}` : `[Cache Miss] Vault ${contractId}`);

            // 1. Fetch Main Token
            const lpToken = await fetchTokenFromCache(contractId);
            if (!lpToken) {
                console.error(`[Fetch Scratch] Failed to fetch main token ${contractId}`);
                return null;
            }

            // Determine vault type - default to POOL if not specified
            const vaultType = lpToken.type?.toUpperCase() || 'POOL';

            // 2. If this is a POOL or SUBLINK, extract underlying token contracts and fetch them
            let tokenA = null;
            let tokenB = null;

            if (vaultType === 'POOL' || vaultType === 'SUBLINK') {
                // Extract underlying token contracts
                const tokenAContract = lpToken.tokenAContract || (lpToken.properties?.tokenAContract) || (lpToken.tokenA?.contractId) || (lpToken.tokenA?.contract_principal);
                const tokenBContract = lpToken.tokenBContract || (lpToken.properties?.tokenBContract) || (lpToken.tokenB?.contractId) || (lpToken.tokenB?.contract_principal);

                // Only proceed if we have tokenA and tokenB contracts
                if (tokenAContract && tokenBContract) {
                    // 3. Fetch Underlying Tokens
                    [tokenA, tokenB] = await Promise.all([
                        fetchTokenFromCache(tokenAContract),
                        fetchTokenFromCache(tokenBContract)
                    ]);

                    if (!tokenA || !tokenB) {
                        console.warn(`[Fetch Scratch] Failed to fetch one or both underlying tokens for ${contractId} (A: ${tokenAContract}, B: ${tokenBContract})`);
                        // Continue anyway, we'll build the vault without the missing tokens
                    } else {
                        // Assign contractId if missing (can happen if fetched directly)
                        if (!tokenA.contractId) tokenA.contractId = tokenAContract;
                        if (!tokenB.contractId) tokenB.contractId = tokenBContract;
                    }
                } else {
                    console.warn(`[Fetch Scratch] Could not determine underlying token contracts for ${vaultType} type ${contractId}`);
                    // Continue anyway, we'll build the vault without underlying tokens
                }
            }

            // 4. Build Initial Vault Structure - tokens can be null for non-POOL/SUBLINK types
            const initialVault = buildVaultStructureFromTokens(contractId, lpToken, tokenA, tokenB);
            if (!initialVault) {
                console.error(`[Fetch Scratch] Failed to build initial vault structure for ${contractId}`);
                return null;
            }

            // 5. Fetch Reserves for POOL and SUBLINK vault types if both tokens are available
            let vaultWithReserves = initialVault;
            if ((vaultType === 'POOL' || vaultType === 'SUBLINK') && tokenA && tokenB) {
                console.log(`[Fetch Scratch] Fetching reserves for newly built ${vaultType} ${contractId}...`);
                vaultWithReserves = await fetchAndUpdateReserves(initialVault);
            }

            // 6. Save the complete vault data to cache
            console.log(`[Fetch Scratch] Saving fully constructed vault ${contractId} to cache...`);
            const saved = await saveVaultData(vaultWithReserves);
            if (!saved) {
                // Log error, but still return the data if we have it
                console.error(`[Fetch Scratch] Failed to save vault ${contractId} to cache, but returning fetched data.`);
            }

            return vaultWithReserves; // Return the newly fetched and constructed vault
        }
    } catch (error) {
        console.error(`Error in getVaultData for ${contractId}:`, error);
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
            // Ignore cache miss
        }

        // Only overwrite type/protocol if defined in new vault
        const vaultToSave = {
            ...vault,
            type: vault.type ?? existing?.type ?? 'POOL',
            protocol: vault.protocol ?? existing?.protocol ?? 'CHARISMA',
            reservesLastUpdatedAt: vault.reservesLastUpdatedAt || Date.now()
        };

        // Make sure reserves are numbers if present
        if (vaultToSave.reservesA !== undefined) {
            vaultToSave.reservesA = Number(vaultToSave.reservesA || 0);
        }
        if (vaultToSave.reservesB !== undefined) {
            vaultToSave.reservesB = Number(vaultToSave.reservesB || 0);
        }

        try {
            // Use JSON.stringify for saving data to KV
            await kv.set(cacheKey, JSON.stringify(vaultToSave), { ex: CACHE_DURATION_SECONDS });
        } catch (setError) {
            console.error('Error during KV.set operation:', setError);
            throw new Error(`KV.set failed: ${setError instanceof Error ? setError.message : 'Unknown error'}`);
        }

        // Try to add to the managed vault list
        try {
            await addVaultIdToManagedList(vault.contractId);
        } catch (listError) {
            console.error('Error adding to managed vault list:', listError);
        }

        return true;
    } catch (error) {
        console.error(`Error saving vault ${vault.contractId}:`, error);
        return false;
    }
};

// Get all vault data from KV
export const getAllVaultData = async (protocol?: string): Promise<Vault[]> => {
    try {
        const vaultIds = await getManagedVaultIds();
        if (!vaultIds.length) {
            console.log('No managed vaults found');
            return [];
        }

        console.log(`Fetching ${vaultIds.length} vaults from cache`);

        // Fetch each vault in parallel using the updated getVaultData
        // Note: This will trigger reserve revalidation for stale entries
        const vaultPromises = vaultIds.map(id => getVaultData(id));

        let results = await Promise.all(vaultPromises);
        function isVault(v: Vault | null): v is Vault {
            return v !== null;
        }
        const vaults = results.filter(isVault);
        if (protocol) {
            return vaults.filter(vault => vault.protocol?.toLowerCase() === protocol.toLowerCase());
        }
        return vaults;
    } catch (error) {
        console.error('Error fetching all vaults:', error);
        return [];
    }
};

// Get all vault data from KV
export const getAllVaults = async (): Promise<{ pools: Vault[], sublinks: Vault[] }> => {
    try {
        const vaultIds = await getManagedVaultIds();
        if (!vaultIds.length) {
            console.log('No managed vaults found');
            return { pools: [], sublinks: [] };
        }

        console.log(`Fetching ${vaultIds.length} vaults from cache`);

        // Fetch each vault in parallel using the updated getVaultData
        // Note: This will trigger reserve revalidation for stale entries
        const vaultPromises = vaultIds.map(id => getVaultData(id));

        const vaults = await Promise.all(vaultPromises);

        // partition by type
        const results = {
            pools: vaults.filter((v): v is Vault => v !== null && v.type === 'POOL') as Vault[],
            sublinks: vaults.filter((v): v is Vault => v !== null && v.type === 'SUBLINK') as Vault[]
        }
        return results;
    } catch (error) {
        console.error('Error fetching all vaults:', error);
        return { pools: [], sublinks: [] };
    }
};

// Utility to remove vaults from the managed list and delete their cache
export const removeVaults = async (vaultIds: string[]): Promise<void> => {
    if (!vaultIds.length) return;
    try {
        // Remove from managed list
        const current = await getManagedVaultIds();
        const updated = current.filter(id => !vaultIds.includes(id));
        await kv.set(VAULT_LIST_KEY, updated);
        // Delete individual cache entries
        for (const id of vaultIds) {
            const cacheKey = getCacheKey(id);
            await kv.del(cacheKey);
            console.log(`Deleted vault and cache for ${id}`);
        }
    } catch (error) {
        console.error('Error removing vaults:', error);
    }
};

export const listVaultTokens = async (): Promise<Token[]> => {
    const vaults = await getAllVaultData();
    const tokenMap = new Map<string, Token>(); // Key: contractId, Value: Token object

    const filteredVaults = vaults.filter(v => v.type === 'POOL' || v.type === 'SUBLINK');

    for (const vault of filteredVaults) {
        // Process tokenA if it exists
        if (vault.tokenA && vault.tokenA.contractId) { // Ensure token and contractId exist
            if (!tokenMap.has(vault.tokenA.contractId)) {
                tokenMap.set(vault.tokenA.contractId, vault.tokenA);
            }
        }
        // Process tokenB if it exists
        if (vault.tokenB && vault.tokenB.contractId) { // Ensure token and contractId exist
            if (!tokenMap.has(vault.tokenB.contractId)) {
                tokenMap.set(vault.tokenB.contractId, vault.tokenB);
            }
        }
    }
    return Array.from(tokenMap.values());
}


// Example usage (uncomment to run once, then re-comment):
removeVaults([
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-welsh-vault-wrapper-alex'
]);