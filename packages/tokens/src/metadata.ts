import { TokenCacheData } from "./token-cache-client";

const TOKEN_CACHE = process.env.NEXT_PUBLIC_TOKEN_CACHE_URL || process.env.TOKEN_CACHE_URL || 'https://tokens.charisma.rocks'
if (!TOKEN_CACHE) {
    throw new Error('TOKEN_CACHE is not set');
}

/**
 * Retrieve a list of all known metadata from the token-cache service.
 */
export async function fetchMetadata(): Promise<TokenCacheData[]> {
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