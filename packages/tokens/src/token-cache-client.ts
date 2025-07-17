
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
    contractId: string;
    name: string;
    description?: string | null;
    image?: string | null;
    lastUpdated?: number | null;
    decimals?: number;
    symbol: string;
    token_uri?: string | null;
    identifier: string;
    total_supply?: string | null;
    tokenAContract?: string | null;
    tokenBContract?: string | null;
    lpRebatePercent?: number | null;
    externalPoolId?: string | null;
    engineContractId?: string | null;
    base?: string | null;
    usdPrice?: number | null;
    confidence?: number | null;
    marketPrice?: number | null;
    intrinsicValue?: number | null;
    totalLiquidity?: number | null;
}

interface TokenCacheResponse {
    status: 'success' | 'error';
    data?: Partial<TokenCacheData>;
    error?: string;
    message?: string;
}

// --------------------------- helpers ---------------------------
function createDefaultTokenData(contractId: string): TokenCacheData {

    return {
        contractId,
        name: '',
        description: '',
        image: null,
        lastUpdated: null,
        decimals: 6,
        symbol: '',
        token_uri: null,
        identifier: '',
        total_supply: null,
        tokenAContract: null,
        tokenBContract: null,
        // Initialize new fields
        type: '',
        lpRebatePercent: null,
        externalPoolId: null,
        engineContractId: null,
        base: null,
    };
}

// --------------------------- public API ---------------------------
/**
 * Retrieve SIP-10 token metadata via the shared token-cache service.
 * Falls back to a reasonable default structure when the cache is unavailable or incomplete.
 */
export async function getTokenMetadataCached(contractId: string): Promise<TokenCacheData> {
    if (!contractId.includes('.')) {
        return {
            type: 'token' as const,
            contractId: '*',
            name: 'Token not found',
            symbol: '*',
            decimals: 6,
            identifier: '*',
        };
    }

    const url = `${TOKEN_CACHE}/api/v1/sip10/${contractId}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`Token-cache API error for ${contractId}: ${response.status} ${response.statusText}`);
            return createDefaultTokenData(contractId);
        }

        const result = (await response.json()) as TokenCacheResponse;

        if (result.status === 'success' && result.data) {
            const defaults = createDefaultTokenData(contractId);
            return { ...defaults, ...result.data };
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
export async function listTokens(): Promise<TokenCacheData[]> {
    const url = `${TOKEN_CACHE}/api/v1/sip10`;

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
        return tokensArray as TokenCacheData[];

    } catch (err) {
        console.error(`Failed to fetch or parse token list:`, err);
        // Return empty array or throw error
        return [];
    }
}

/**
 * Retrieve a list of all known metadata from the token-cache service.
 */
export async function fetchMetadata(): Promise<any[]> {
    const url = `${TOKEN_CACHE}/api/v1/metadata`;
    console.log(`Fetching metadata from ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Token-cache API error listing metadata: ${response.status} ${response.statusText}`);
            return [];
        }
        const result: any = await response.json();
        return result;

    } catch (err) {
        console.error(`Failed to fetch or parse metadata:`, err);
        return [];
    }
}