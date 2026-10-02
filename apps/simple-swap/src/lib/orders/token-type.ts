const TOKEN_CACHE = process.env.NEXT_PUBLIC_TOKEN_CACHE_URL || process.env.TOKEN_CACHE_URL || 'https://tokens.charisma.rocks';

/** Returns the token's type from the token cache, or null when the cache cannot answer. Never fabricates a record. */
export async function fetchTokenType(contractId: string): Promise<string | null> {
    const res = await fetch(`${TOKEN_CACHE}/api/v1/sip10/${encodeURIComponent(contractId)}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const type = json?.data?.type;
    return typeof type === 'string' && type.length > 0 ? type : null;
}
