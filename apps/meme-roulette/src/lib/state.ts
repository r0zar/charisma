import { kv } from '@vercel/kv';
import type { Token, SpinFeedData, Vote } from '@/types/spin';
import { v4 as uuidv4 } from 'uuid';

// --- Constants ---
export const DEFAULT_ROUND_DURATION_MS = 5 * 60 * 1000; // 5 minutes default
export const DEFAULT_LOCK_DURATION_MS = 1 * 60 * 1000; // 1 minute default
export const TOKEN_REFRESH_INTERVAL = 60 * 1000;
export const UPDATE_INTERVAL = 2000;

// --- KV Keys ---
const KV_SPIN_SCHEDULED_AT = 'spin:scheduled_at';
const KV_WINNING_TOKEN_ID = 'spin:winning_token_id';
const KV_LAST_TOKEN_FETCH = 'spin:last_token_fetch';
const KV_ROUND_DURATION = 'spin:round_duration';
const KV_LOCK_DURATION = 'spin:lock_duration';
export const KV_TOKEN_BETS = 'spin:token_bets';
export const KV_USER_VOTES = 'spin:user_votes';

// --- Get Current Round Duration ---
export async function getRoundDuration(): Promise<number> {
    const duration = await kv.get<number>(KV_ROUND_DURATION);
    return duration ?? DEFAULT_ROUND_DURATION_MS;
}

// --- Set Round Duration ---
export async function setRoundDuration(durationMs: number): Promise<void> {
    if (!durationMs || durationMs < 60000) { // minimum 1 minute
        throw new Error('Round duration must be at least 1 minute');
    }
    await kv.set(KV_ROUND_DURATION, durationMs);
    console.log(`Round duration set to ${durationMs}ms (${durationMs / 60000} minutes)`);
}

// --- Get Current Lock Duration ---
export async function getLockDuration(): Promise<number> {
    const duration = await kv.get<number>(KV_LOCK_DURATION);
    return duration ?? DEFAULT_LOCK_DURATION_MS;
}

// --- Set Lock Duration ---
export async function setLockDuration(durationMs: number): Promise<void> {
    if (!durationMs || durationMs < 30000) { // minimum 30 seconds
        throw new Error('Lock duration must be at least 30 seconds');
    }
    await kv.set(KV_LOCK_DURATION, durationMs);
    console.log(`Lock duration set to ${durationMs}ms (${durationMs / 60000} minutes)`);
}

// --- Initialization Function ---
export async function initializeKVState() {
    const now = Date.now();
    const roundDuration = await getRoundDuration();
    const initialSpinTime = now + roundDuration;

    await Promise.all([
        kv.set(KV_SPIN_SCHEDULED_AT, initialSpinTime, { nx: true }),
        kv.set(KV_WINNING_TOKEN_ID, null, { nx: true }),
        kv.set(KV_LAST_TOKEN_FETCH, 0, { nx: true }),
        kv.set(KV_ROUND_DURATION, roundDuration, { nx: true }),
        kv.set(KV_LOCK_DURATION, DEFAULT_LOCK_DURATION_MS, { nx: true }),
    ]);

    // Initialize the hash only if it doesn't exist
    const exists = await kv.exists(KV_TOKEN_BETS);
    if (!exists) {
        await kv.hset(KV_TOKEN_BETS, { '_init': '1' }); // Use 2-arg hset
    }

    // Initialize user votes if it doesn't exist
    const votesExists = await kv.exists(KV_USER_VOTES);
    if (!votesExists) {
        await kv.set(KV_USER_VOTES, {});
    }

    console.log('KV State Initialized (if needed).');
}

// --- User Vote Tracking ---

// Store a user's vote in KV
export async function recordUserVote(
    userId: string,
    tokenId: string,
    amount: number
): Promise<Vote | null> {
    if (!userId || !tokenId || typeof amount !== 'number' || amount <= 0) {
        console.warn('Invalid vote data:', { userId, tokenId, amount });
        return null;
    }

    try {
        // Create a new vote object
        const vote: Vote = {
            id: uuidv4(), // Generate a unique ID for this vote
            userId,
            tokenId,
            voteAmountCHA: amount,
            voteTime: Date.now()
        };

        // Get current all_votes object
        const currentVotes = await kv.get<Record<string, Vote[]>>(KV_USER_VOTES) || {};

        // Add this vote to the user's votes array
        if (!currentVotes[userId]) {
            currentVotes[userId] = [];
        }
        currentVotes[userId].push(vote);

        // Save back to KV
        await kv.set(KV_USER_VOTES, currentVotes);

        console.log(`Recorded vote from user ${userId} for token ${tokenId}: ${amount} CHA`);
        return vote;
    } catch (error) {
        console.error(`Failed to record vote for user ${userId}:`, error);
        return null;
    }
}

// Get all votes for a specific user
export async function getUserVotes(userId: string): Promise<Vote[]> {
    try {
        const allVotes = await kv.get<Record<string, Vote[]>>(KV_USER_VOTES) || {};
        return allVotes[userId] || [];
    } catch (error) {
        console.error(`Failed to get votes for user ${userId}:`, error);
        return [];
    }
}

// Get all votes across all users
export async function getAllUserVotes(): Promise<Record<string, Vote[]>> {
    try {
        return await kv.get<Record<string, Vote[]>>(KV_USER_VOTES) || {};
    } catch (error) {
        console.error('Failed to get all user votes:', error);
        return {};
    }
}

// --- State Accessor/Modifier Functions (Async) ---

// Gets the last token fetch time (kept for reference)
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

// Function to directly set the spin scheduled time
export async function setKVSpinScheduledAt(timestamp: number) {
    if (typeof timestamp !== 'number') {
        console.warn('Attempted to set invalid spin scheduled time:', timestamp);
        return;
    }
    await kv.set(KV_SPIN_SCHEDULED_AT, timestamp);
    console.log('KV Spin Scheduled Time set to:', new Date(timestamp).toISOString());
}

export async function resetKVForNextSpin() {
    const roundDuration = await getRoundDuration();
    const nextSpinTime = Date.now() + roundDuration;

    await kv.multi()
        .set(KV_SPIN_SCHEDULED_AT, nextSpinTime)
        .set(KV_WINNING_TOKEN_ID, null)
        .del(KV_TOKEN_BETS)
        .set(KV_USER_VOTES, {}) // Reset all user votes
        .exec();

    // Re-initialize the hash (no need for nx check after explicit del)
    await kv.hset(KV_TOKEN_BETS, { '_init': '1' }); // Use 2-arg hset

    console.log(`KV State Reset for next spin with duration: ${roundDuration}ms`);
}

// Simplified: gets basic spin info (time, winner)
export async function getKVSpinStatus(): Promise<{
    spinScheduledAt: number;
    winningTokenId: string | null;
    roundDuration: number;
}> {
    const [spinScheduledAt, winningTokenId, roundDuration] = await kv.mget<[number | null, string | null, number | null]>(
        KV_SPIN_SCHEDULED_AT,
        KV_WINNING_TOKEN_ID,
        KV_ROUND_DURATION
    );

    const now = Date.now();
    const actualRoundDuration = roundDuration ?? DEFAULT_ROUND_DURATION_MS;

    return {
        spinScheduledAt: spinScheduledAt ?? (now + actualRoundDuration),
        winningTokenId: winningTokenId ?? null,
        roundDuration: actualRoundDuration,
    };
}

// --- Data Packet Builder ---
export async function buildKVDataPacket(): Promise<Omit<SpinFeedData, 'initialTokens'>> {
    const status = await getKVSpinStatus();
    const bets = await getKVTokenBets();
    const lockDuration = await getLockDuration();
    const now = Date.now();

    return {
        type: status.winningTokenId ? 'spin_result' : 'update',
        lastUpdated: now,
        startTime: status.spinScheduledAt - status.roundDuration, // Calculate actual start time
        endTime: status.spinScheduledAt,
        winningTokenId: status.winningTokenId ?? undefined,
        tokenVotes: bets,
        roundDuration: status.roundDuration, // Include round duration in the packet
        lockDuration: lockDuration // Include lock duration in the packet
    };
} 