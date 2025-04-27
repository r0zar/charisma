import { kv } from '@vercel/kv';
import type { Token, SpinFeedData } from '@/types/spin';
import type { TokenCacheData } from '@repo/tokens';
import { listTokens } from '@repo/tokens';

// --- Constants ---
export const DEV_INITIAL_DURATION_MS = 60 * 60 * 1000;
export const PROD_INITIAL_DURATION_MS = 5 * 60 * 1000;
export const TOKEN_REFRESH_INTERVAL = 60 * 1000;
export const UPDATE_INTERVAL = 2000;
export const IS_DEV = process.env.NODE_ENV === 'development';
export const TOKEN_CACHE_API_BASE_URL = process.env.NODE_ENV === 'production' ? 'https://charisma-token-cache.vercel.app' : 'http://localhost:3000';

// --- KV Keys ---
const KV_SPIN_SCHEDULED_AT = 'spin:scheduled_at';
// const KV_TOTAL_BET_CHA = 'spin:total_bet_cha'; // REMOVED
const KV_WINNING_TOKEN_ID = 'spin:winning_token_id';
const KV_CURRENT_TOKENS = 'spin:current_tokens';
const KV_LAST_TOKEN_FETCH = 'spin:last_token_fetch';
export const KV_TOKEN_BETS = 'spin:token_bets'; // Export this for use in route.ts

// --- Initialization Function ---
export async function initializeKVState() {
    const now = Date.now();
    const initialSpinTime = now + (IS_DEV ? DEV_INITIAL_DURATION_MS : PROD_INITIAL_DURATION_MS);

    await Promise.all([
        kv.set(KV_SPIN_SCHEDULED_AT, initialSpinTime, { nx: true }),
        kv.set(KV_WINNING_TOKEN_ID, null, { nx: true }),
        kv.set(KV_CURRENT_TOKENS, [], { nx: true }),
        kv.set(KV_LAST_TOKEN_FETCH, 0, { nx: true }),
    ]);

    // Initialize the hash only if it doesn't exist
    const exists = await kv.exists(KV_TOKEN_BETS);
    if (!exists) {
        await kv.hset(KV_TOKEN_BETS, { '_init': '1' }); // Use 2-arg hset
    }

    console.log('KV State Initialized (if needed).');
}

// --- State Accessor/Modifier Functions (Async) ---

// Fetches the full list of current tokens (used for initial connect & modal)
export async function getKVTokens(): Promise<Token[]> {
    return await kv.get<Token[]>(KV_CURRENT_TOKENS) ?? [];
}

export async function setTokensInKV(tokens: Token[]) {
    await kv.set(KV_CURRENT_TOKENS, tokens);
    await kv.set(KV_LAST_TOKEN_FETCH, Date.now());
}

// Gets the last token fetch time
export async function getKVLastTokenFetchTime(): Promise<number> {
    return await kv.get<number>(KV_LAST_TOKEN_FETCH) ?? 0;
}

// Increments the bet amount for a specific token in the KV hash
export async function incrementKVTokenBet(tokenId: string, amount: number): Promise<number | null> {
    if (!tokenId || typeof tokenId !== 'string' || typeof amount !== 'number' || amount <= 0) {
        console.warn('Attempted to increment token bet with invalid data:', { tokenId, amount });
        return null; // Indicate failure or invalid input
    }
    try {
        // Use hincrby for atomic increment within the hash
        return await kv.hincrby(KV_TOKEN_BETS, tokenId, amount);
    } catch (error) {
        console.error(`Failed to increment bet for token ${tokenId} in KV:`, error);
        return null;
    }
}

// Retrieves all token bets from the KV hash
export async function getKVTokenBets(): Promise<Record<string, number>> {
    try {
        // HGETALL returns an object { field1: value1, field2: value2, ... } or null
        const bets = await kv.hgetall<Record<string, number>>(KV_TOKEN_BETS);
        // Ensure numeric values if KV stores everything as strings internally
        if (bets) {
            Object.keys(bets).forEach(key => {
                // Remove dummy field if present
                if (key === '_init') {
                    delete bets[key];
                    return;
                }
                // Convert potentially stringified numbers back to numbers
                const numericValue = Number(bets[key]);
                bets[key] = isNaN(numericValue) ? 0 : numericValue;
            });
            return bets;
        }
        return {}; // Return empty object if hash doesn't exist or is empty
    } catch (error) {
        console.error("Failed to get token bets from KV:", error);
        return {}; // Return empty on error
    }
}

export async function setKVWinningToken(tokenId: string | null) {
    await kv.set(KV_WINNING_TOKEN_ID, tokenId);
}

// NEW: Function to directly set the spin scheduled time
export async function setKVSpinScheduledAt(timestamp: number) {
    if (typeof timestamp !== 'number') {
        console.warn('Attempted to set invalid spin scheduled time:', timestamp);
        return;
    }
    await kv.set(KV_SPIN_SCHEDULED_AT, timestamp);
    console.log('KV Spin Scheduled Time set to:', new Date(timestamp).toISOString());
}

export async function resetKVForNextSpin() {
    const nextSpinTime = Date.now() + (IS_DEV ? DEV_INITIAL_DURATION_MS : PROD_INITIAL_DURATION_MS);

    await kv.multi()
        .set(KV_SPIN_SCHEDULED_AT, nextSpinTime)
        .set(KV_WINNING_TOKEN_ID, null)
        .del(KV_TOKEN_BETS)
        .exec();

    // Re-initialize the hash (no need for nx check after explicit del)
    await kv.hset(KV_TOKEN_BETS, { '_init': '1' }); // Use 2-arg hset

    console.log('KV State Reset for next spin (bets cleared).');
}

// Simplified: gets basic spin info (time, winner)
export async function getKVSpinStatus(): Promise<{
    spinScheduledAt: number;
    winningTokenId: string | null;
}> {
    const [spinScheduledAt, winningTokenId] = await kv.mget<[number | null, string | null]>(
        KV_SPIN_SCHEDULED_AT,
        KV_WINNING_TOKEN_ID
    );
    const now = Date.now();
    return {
        spinScheduledAt: spinScheduledAt ?? (now + (IS_DEV ? DEV_INITIAL_DURATION_MS : PROD_INITIAL_DURATION_MS)),
        winningTokenId: winningTokenId ?? null,
    };
}

// --- Token Fetching Logic ---
export const mapTokenCacheToToken = (cacheToken: TokenCacheData): Token => {
    let imageUrl = cacheToken.image || '/placeholder-token.png';
    if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
        imageUrl = `${TOKEN_CACHE_API_BASE_URL}/${imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl}`;
    } else if (imageUrl && imageUrl.startsWith('/')) {
        // Keep relative path
    }
    return {
        id: cacheToken.contract_principal!, // Ensure this field is reliable
        name: cacheToken.name,
        symbol: cacheToken.symbol,
        imageUrl: imageUrl,
        userBalance: 0,
    };
};

export async function fetchAndSetKVTokens() {
    console.log('Attempting to fetch and set tokens in KV...');
    try {
        const freshCacheTokens = await listTokens();
        const mappedTokens = freshCacheTokens.map(mapTokenCacheToToken);
        await setTokensInKV(mappedTokens);
        console.log(`KV Token list updated (${mappedTokens.length} tokens).`);
    } catch (error) {
        console.error("Failed to fetch/set token list in KV:", error);
    }
}

// --- Data Packet Builder (Now fetches bets) ---
export async function buildKVDataPacket(): Promise<Omit<SpinFeedData, 'initialTokens'>> {
    const status = await getKVSpinStatus();
    const bets = await getKVTokenBets();
    const now = Date.now();

    return {
        type: status.winningTokenId ? 'spin_result' : 'update',
        lastUpdated: now,
        startTime: now - 1000, // Just for type compatibility, not used in this context
        endTime: status.spinScheduledAt,
        winningTokenId: status.winningTokenId ?? undefined,
        tokenVotes: bets
    };
} 