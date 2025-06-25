const TOKEN_CACHE_API_BASE_URL = process.env.NODE_ENV === 'production' ? 'https://charisma-token-cache.vercel.app' : 'http://localhost:3000'; // Assuming token-cache runs on 3000 locally

// Updated interface based on actual API response structure
interface TokenCacheData {
    contractId: string; // The contract ID requested (might differ from principal if it's a wrapper?)
    name: string;
    description?: string | null;
    image?: string | null;
    lastUpdated?: number | null;
    decimals: number;
    symbol: string;
    token_uri?: string | null; // Note the underscore
    error?: string | null; // API might include error details even on success? Or mark if data is default
    identifier?: string | null;
    total_supply?: string | null; // Keep this if API might include it
    // Add any other fields observed from the API
}

interface TokenCacheResponse {
    status: 'success' | 'error';
    data?: Partial<TokenCacheData>; // Data might be incomplete even on success
    error?: string; // Top-level error message
    message?: string;
}

// Helper to create a default token object based on contract ID
function createDefaultTokenData(contractId: string): TokenCacheData {
    const parts = contractId.split('.');
    const contractName = parts[1] || 'UnknownContract';
    // Simple capitalization for name
    const defaultName = contractName.replace(/-/g, ' ').replace(/(?:^|\s)\S/g, a => a.toUpperCase());
    // Attempt to generate a symbol (e.g., first 3-5 chars of name, uppercase)
    const defaultSymbol = contractName.substring(0, 5).toUpperCase();

    return {
        contractId: contractId,
        name: defaultName,
        description: 'Default data - cache unavailable',
        image: null,
        lastUpdated: null,
        decimals: 6, // Default to 6 decimals as a guess
        symbol: defaultSymbol,
        token_uri: null,
        error: 'Cache data unavailable', // Mark that this is default data
        identifier: null,
        total_supply: null,
    };
}

/**
 * Fetches SIP-10 token metadata from the token-cache API.
 * Provides a default fallback object for missing fields or if the API call fails entirely.
 * 
 * @param contractId The full contract ID (e.g., SP...contract.name)
 * @returns The token metadata, potentially merged with defaults if incomplete, or a fully default object on complete failure.
 */
export async function getTokenMetadataCached(contractId: string): Promise<TokenCacheData> {
    const url = `${TOKEN_CACHE_API_BASE_URL}/api/v1/sip10/${contractId}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Token cache API error for ${contractId}: ${response.status} ${response.statusText}`);
            return createDefaultTokenData(contractId); // Full fallback on network/server error
        }
        const result: TokenCacheResponse = await response.json();

        if (result.status === 'success' && result.data) {
            const defaultData = createDefaultTokenData(contractId);
            // Merge received data with defaults, prioritizing received data if valid
            const mergedData: TokenCacheData = {
                ...defaultData, // Start with defaults
                ...result.data, // Overlay received data
                // Ensure core fields have valid types, falling back to default if not
                name: typeof result.data.name === 'string' ? result.data.name : defaultData.name,
                symbol: typeof result.data.symbol === 'string' ? result.data.symbol : defaultData.symbol,
                decimals: typeof result.data.decimals === 'number' ? result.data.decimals : defaultData.decimals,
                contractId: result.data.contractId || defaultData.contractId, // Ensure contractId is present
                error: result.data.error || null // Preserve error from data if present, clear default error message
            };

            // Log if we had to use defaults for core fields despite success status
            if (mergedData.name === defaultData.name || mergedData.symbol === defaultData.symbol || mergedData.decimals === defaultData.decimals) {
                if (result.data.name !== mergedData.name || result.data.symbol !== mergedData.symbol || result.data.decimals !== mergedData.decimals) {
                    console.warn(`Cache API returned success for ${contractId} but some core data was missing/invalid. Used defaults for missing fields.`);
                    // Optionally mark the data as partially defaulted
                    mergedData.error = mergedData.error ? `${mergedData.error}; Partially defaulted` : 'Partially defaulted';
                }
            }
            // Clear the default error if we got successful data, unless API provided its own error
            if (mergedData.error === 'Cache data unavailable' && !result.data.error) {
                mergedData.error = null;
            }

            return mergedData;

        } else {
            // Handle cases where status is 'error' or status is 'success' but data is missing
            console.error(`Token cache API returned status '${result.status}' or missing data for ${contractId}: ${result.error || result.message}`);
            return createDefaultTokenData(contractId); // Full fallback
        }
    } catch (error) {
        console.error(`Failed to fetch or parse from token cache API for ${contractId}:`, error);
        return createDefaultTokenData(contractId); // Full fallback on network/parsing error
    }
}

// TODO: Add functions for other cached calls if the token-cache API supports them
// e.g., getBalanceCached, callReadOnlyCached 