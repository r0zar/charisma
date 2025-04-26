// (No external imports required)

// Base URL for the token-cache API – override via environment variable (e.g. NEXT_PUBLIC_TOKEN_CACHE_API_BASE_URL)
const TOKEN_CACHE_API_BASE_URL =
    process.env.NODE_ENV === 'production' ? 'https://charisma-token-cache.vercel.app' : 'http://localhost:3000';

/**
 * Shape of the token metadata returned by the token-cache service.
 * Mirrors the API as closely as possible so consumers can rely on strong typing
 * without having to duplicate these interfaces everywhere.
 */
export interface TokenCacheData {
    contractId: string;
    name: string;
    description?: string | null;
    image?: string | null;
    lastUpdated?: number | null;
    decimals: number;
    symbol: string;
    token_uri?: string | null;
    contract_principal?: string | null;
    error?: string | null;
    identifier?: string | null;
    totalSupply?: string | null;
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
        description: 'Default data – cache unavailable',
        image: null,
        lastUpdated: null,
        decimals: 6, // sensible default until fetched
        symbol: defaultSymbol,
        token_uri: null,
        contract_principal: principal && contractName ? `${principal}.${contractName}` : contractId,
        error: 'Cache data unavailable',
        identifier: null,
        totalSupply: null,
    };
}

// --------------------------- public API ---------------------------
/**
 * Retrieve SIP-10 token metadata via the shared token-cache service.
 * Falls back to a reasonable default structure when the cache is unavailable or incomplete.
 */
export async function getTokenMetadataCached(contractId: string): Promise<TokenCacheData> {
    const url = `${TOKEN_CACHE_API_BASE_URL}/api/v1/sip10/${contractId}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Token-cache API error for ${contractId}: ${response.status} ${response.statusText}`);
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
                    typeof result.data.decimals === 'number' && !Number.isNaN(result.data.decimals)
                        ? result.data.decimals
                        : defaults.decimals,
                contractId: result.data.contractId || defaults.contractId,
                error: result.data.error || null,
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