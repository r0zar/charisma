import { TokenCacheData } from '@/lib/contract-registry-adapter';

/**
 * Get the list of managed token IDs
 * 
 * This function returns the list of token contract IDs that the application manages.
 * It's implemented separately to isolate the external API call to the server component.
 */
export async function getManagedTokenIds(): Promise<string[]> {
    // This could come from a configuration file, database, or API call
    // For now, we'll return a hardcoded list of tokens
    return [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy',
        // Add more token IDs as needed
    ];
}

/**
 * Get token data from an API route
 * 
 * This function is meant to be used in client components that need to fetch
 * token data. It uses the application's API routes rather than directly importing
 * server-only code.
 */
export async function getTokenData(tokenId: string): Promise<TokenCacheData | null> {
    try {
        const response = await fetch(`/api/tokens/${encodeURIComponent(tokenId)}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch token data: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Error fetching token data for ${tokenId}:`, error);
        return null;
    }
}

/**
 * Get all tokens data from an API route
 * 
 * This function is meant to be used in client components that need to fetch
 * all tokens data. It uses the application's API routes rather than directly importing
 * server-only code.
 */
export async function getAllTokens(): Promise<TokenCacheData[]> {
    try {
        const response = await fetch('/api/tokens');

        if (!response.ok) {
            throw new Error(`Failed to fetch tokens: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching all tokens:', error);
        return [];
    }
}