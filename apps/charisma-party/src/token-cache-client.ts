const TOKEN_CACHE = process.env.NEXT_PUBLIC_TOKEN_CACHE_URL || process.env.TOKEN_CACHE_URL || 'https://tokens.charisma.rocks';

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
}

export async function listTokens(): Promise<TokenCacheData[]> {
    const url = `${TOKEN_CACHE}/api/v1/sip10`;
    console.log(`Fetching tokens from ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Token-cache API error listing tokens: ${response.status} ${response.statusText}`);
            return [];
        }
        const result: any = await response.json();
        const tokensArray = Array.isArray(result) ? result :
            (result.data && Array.isArray(result.data)) ? result.data : [];
        return tokensArray as TokenCacheData[];
    } catch (err) {
        console.error(`Failed to fetch or parse token list:`, err);
        return [];
    }
} 