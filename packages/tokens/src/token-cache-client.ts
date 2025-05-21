import { SIP10 } from "./token";

const TOKEN_CACHE = process.env.NEXT_PUBLIC_TOKEN_CACHE_URL || process.env.TOKEN_CACHE_URL || 'https://tokens.charisma.rocks'
if (!TOKEN_CACHE) {
    throw new Error('TOKEN_CACHE is not set');
}

/**
 * Shape of the token metadata returned by the token-cache service.
 * Mirrors the API as closely as possible so consumers can rely on strong typing
 */
export interface TokenCacheData {
    type: string;
    contractId?: string;
    name: string;
    description?: string | null;
    image?: string | null;
    lastUpdated?: number | null;
    decimals?: number;
    symbol?: string;
    token_uri?: string | null;
    contract_principal?: string | null;
    error?: string | null;
    identifier?: string | null;
    total_supply?: string | null;
    tokenAContract?: string | null;
    tokenBContract?: string | null;
    lpRebatePercent?: number | null;
    externalPoolId?: string | null;
    engineContractId?: string | null;
}

interface TokenCacheResponse {
    status: 'success' | 'error';
    data?: Partial<TokenCacheData>;
    error?: string;
    message?: string;
}

// --------------------------- helpers ---------------------------
function createDefaultTokenData(contractId: string): TokenCacheData {
    const [principal, contractName] = contractId.split('.');
    const defaultName = (contractName || 'UnknownContract')
        .replace(/-/g, ' ')
        .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
    const defaultSymbol = (contractName || '').substring(0, 5).toUpperCase();

    return {
        contractId,
        name: defaultName,
        description: 'Default data - cache unavailable',
        image: null,
        lastUpdated: null,
        decimals: 6, // sensible default until fetched
        symbol: defaultSymbol,
        token_uri: null,
        contract_principal: principal && contractName ? `${principal}.${contractName}` : contractId,
        error: 'Cache data unavailable',
        identifier: null,
        total_supply: null,
        tokenAContract: null,
        tokenBContract: null,
        // Initialize new fields
        type: '',
        lpRebatePercent: null,
        externalPoolId: null,
        engineContractId: null,
    };
}

// --------------------------- public API ---------------------------
/**
 * Retrieve SIP-10 token metadata via the shared token-cache service.
 * Falls back to a reasonable default structure when the cache is unavailable or incomplete.
 */
export async function getTokenMetadataCached(contractId: string): Promise<TokenCacheData> {
    const url = `https://tokens.charisma.rocks/api/v1/sip10/${contractId}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`Token-cache API error for ${contractId}: ${response.status} ${response.statusText}`);
            return createDefaultTokenData(contractId);
        }

        const result = (await response.json()) as TokenCacheResponse;

        if (result.status === 'success' && result.data) {
            const defaults = createDefaultTokenData(contractId);
            const merged: TokenCacheData = {
                ...defaults,
                ...result.data,
                // ensure required fields are always present with the correct types
                name:
                    typeof result.data.name === 'string' && result.data.name.trim() !== ''
                        ? result.data.name
                        : defaults.name,
                symbol:
                    typeof result.data.symbol === 'string' && result.data.symbol.trim() !== ''
                        ? result.data.symbol
                        : defaults.symbol,
                decimals:
                    !Number.isNaN(Number(result.data.decimals))
                        ? Number(result.data.decimals)
                        : defaults.decimals,
                contractId: result.data.contractId || defaults.contractId,
                error: result.data.error || null,
                // Ensure new fields are also merged appropriately, falling back to defaults if not present or wrong type
                type: typeof result.data.type === 'string' ? result.data.type : defaults.type,
                lpRebatePercent: typeof result.data.lpRebatePercent === 'number' ? result.data.lpRebatePercent : defaults.lpRebatePercent,
                externalPoolId: typeof result.data.externalPoolId === 'string' ? result.data.externalPoolId : defaults.externalPoolId,
                engineContractId: typeof result.data.engineContractId === 'string' ? result.data.engineContractId : defaults.engineContractId,
            };

            // If anything critical dropped back to the default value, make a note in the error field.
            if (
                merged.name === defaults.name ||
                merged.symbol === defaults.symbol ||
                merged.decimals === defaults.decimals
            ) {
                merged.error = merged.error ? `${merged.error}; partially defaulted` : 'partially defaulted';
            }

            // Clear default error when data came back fine.
            if (merged.error === 'Cache data unavailable' && !result.data.error) {
                merged.error = null;
            }

            return merged;
        }

        // API responded with an error or missing data
        console.error(
            `Token-cache API returned status '${result.status}' or missing data for ${contractId}: ${result.error || result.message
            }`,
        );
        return createDefaultTokenData(contractId);
    } catch (err) {
        console.error(`Failed to fetch or parse token metadata for ${contractId}:`, err);
        return createDefaultTokenData(contractId);
    }
}

/**
 * Retrieve a list of all known SIP-10 tokens from the token-cache service.
 */
export async function listTokens(): Promise<SIP10[]> {
    const url = `${TOKEN_CACHE}/api/v1/sip10`;

    console.log(`Fetching tokens from ${url}`);
    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Token-cache API error listing tokens: ${response.status} ${response.statusText}`);
            // Return empty array or throw error depending on desired behavior
            return [];
        }

        const result: any = await response.json(); // Assert type as any

        // Assuming the API returns an array directly, or has a 'data' property
        const tokensArray = Array.isArray(result) ? result :
            (result.data && Array.isArray(result.data)) ? result.data : [];

        // Optional: Basic validation/transformation on each item if needed
        // For now, we assume the API returns valid TokenCacheData[]
        // If not, map and validate similar to getTokenMetadataCached
        return tokensArray as SIP10[];

    } catch (err) {
        console.error(`Failed to fetch or parse token list:`, err);
        // Return empty array or throw error
        return [];
    }
}