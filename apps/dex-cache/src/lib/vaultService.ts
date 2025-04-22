import { kv } from "@vercel/kv";
import { Vault } from "@repo/dexterity";

// Cache constants
const CACHE_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const VAULT_LIST_KEY = "vault-list:dex";

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

// Resolve base URL for token-cache API
const getTokenCacheBase = () => {
    const explicit = process.env.TOKEN_CACHE_ENDPOINT;
    if (explicit) return explicit;
    return 'http://localhost:3001'; // Fallback for local dev
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

    const base = getTokenCacheBase();
    if (!base) {
        console.error("Token Cache endpoint/host not configured.");
        return null;
    }
    const url = `${base}/api/v1/sip10/${encodeURIComponent(contractId)}`;
    console.log(`Fetching token from cache: ${url}`);
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            console.warn(`Failed token cache fetch for ${contractId} (${res.status}): ${url}`);
            return null;
        }
        const json = await res.json();
        if (json?.status === 'success' && json?.data) {
            console.log(`Success token cache fetch for ${contractId}`);
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

// Read a vault from KV cache
export const getVaultData = async (contractId: string, refresh?: boolean): Promise<Vault | null> => {
    // Special exception for .stx or other special tokens
    const isSpecialToken = contractId === '.stx';
    if (!contractId || (!isSpecialToken && !contractId.includes('.'))) {
        console.warn(`Invalid contractId format passed to getVaultData: ${contractId}`);
        return null;
    }
    const cacheKey = getCacheKey(contractId);
    try {
        const cached = await kv.get<Vault>(cacheKey);
        if (cached && !refresh) {
            console.log(`Cache hit for vault ${contractId}`);
            return cached;
        } else {
            console.log(`Cache miss for vault ${contractId}`);
            return null;
        }
    } catch (error) {
        console.error(`Error reading vault cache for ${contractId}:`, error);
        return null;
    }
};

// Save vault to KV cache
export const saveVaultData = async (vault: Vault): Promise<boolean> => {
    if (!vault || !vault.contractId) {
        console.error("Cannot save vault: missing contractId");
        return false;
    }
    try {
        const cacheKey = getCacheKey(vault.contractId);

        // Check if the Vercel KV connection is working
        try {
            // Verify connection by doing a simple ping operation
            await kv.set('dex-cache:ping', 'ping-test', { ex: 60 });
            const pingResult = await kv.get('dex-cache:ping');
            if (pingResult !== 'ping-test') {
                console.error('KV connection verification failed. Response:', pingResult);
                throw new Error('Could not verify KV connection');
            }
        } catch (pingError) {
            console.error('KV connection test failed:', pingError);
            throw new Error(`KV connection not working: ${pingError instanceof Error ? pingError.message : 'Unknown error'}`);
        }

        // Try to save the vault now that we know the connection works
        try {
            await kv.set(cacheKey, vault, { ex: CACHE_DURATION_SECONDS });
        } catch (setError) {
            console.error('Error during KV.set operation:', setError);
            throw new Error(`KV.set failed: ${setError instanceof Error ? setError.message : 'Unknown error'}`);
        }

        // Try to add to the managed vault list
        try {
            await addVaultIdToManagedList(vault.contractId);
        } catch (listError) {
            console.error('Error adding to managed vault list:', listError);
            // We don't throw here, as the vault was saved successfully
            // This is a non-critical error
        }

        return true;
    } catch (error) {
        console.error(`Error saving vault ${vault.contractId}:`, error);
        return false;
    }
};

// Get all vault data from KV
export const getAllVaultData = async (): Promise<Vault[]> => {
    try {
        const vaultIds = await getManagedVaultIds();
        if (!vaultIds.length) {
            console.log('No managed vaults found');
            return [];
        }

        console.log(`Fetching ${vaultIds.length} vaults from cache`);
        const vaults: Vault[] = [];

        // Fetch each vault in parallel
        const vaultPromises = vaultIds.map(async (id) => {
            try {
                const vault = await getVaultData(id);
                if (vault) {
                    return vault;
                }
                console.warn(`Vault ${id} not found in cache`);
                return null;
            } catch (error) {
                console.error(`Error fetching vault ${id}:`, error);
                return null;
            }
        });

        const results = await Promise.all(vaultPromises);
        return results.filter((v): v is Vault => v !== null);
    } catch (error) {
        console.error('Error fetching all vaults:', error);
        return [];
    }
}; 