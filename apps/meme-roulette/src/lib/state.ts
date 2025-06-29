import { kv } from '@vercel/kv';
import type { SpinFeedData, Vote } from '@/types/spin';
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
// ATH tracking keys
const KV_ATH_TOTAL_AMOUNT = 'spin:ath_total_amount';
const KV_PREVIOUS_ROUND_AMOUNT = 'spin:previous_round_amount';

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

// --- ATH Tracking Functions ---

// Get current All-Time High total CHA amount
export async function getATHTotalAmount(): Promise<number> {
    const amount = await kv.get<number>(KV_ATH_TOTAL_AMOUNT);
    return amount ?? 0; // Start from 0 if no ATH exists
}

// Set new All-Time High total CHA amount
export async function setATHTotalAmount(amount: number): Promise<void> {
    if (typeof amount !== 'number' || amount < 0) {
        console.warn('Invalid ATH amount:', amount);
        return;
    }
    await kv.set(KV_ATH_TOTAL_AMOUNT, amount);
    console.log(`New ATH total amount set: ${amount} CHA (atomic units)`);
}

// Get previous round total CHA amount
export async function getPreviousRoundAmount(): Promise<number> {
    const amount = await kv.get<number>(KV_PREVIOUS_ROUND_AMOUNT);
    return amount ?? 0; // Return 0 if no previous round data
}

// Set previous round total CHA amount
export async function setPreviousRoundAmount(amount: number): Promise<void> {
    if (typeof amount !== 'number' || amount < 0) {
        console.warn('Invalid previous round amount:', amount);
        return;
    }
    await kv.set(KV_PREVIOUS_ROUND_AMOUNT, amount);
    console.log(`Previous round amount set: ${amount} CHA (atomic units)`);
}

// Update ATH if current round total exceeds it
export async function updateATHIfNeeded(currentRoundTotal: number): Promise<boolean> {
    const currentATH = await getATHTotalAmount();

    if (currentRoundTotal > currentATH) {
        await setATHTotalAmount(currentRoundTotal);
        console.log(`🏆 NEW ATH! Previous: ${currentATH}, New: ${currentRoundTotal} CHA`);
        return true; // New ATH was set
    }

    return false; // No new ATH
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
        // Initialize ATH tracking with 0 values
        kv.set(KV_ATH_TOTAL_AMOUNT, 0, { nx: true }),
        kv.set(KV_PREVIOUS_ROUND_AMOUNT, 0, { nx: true }),
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

    console.log('KV State Initialized (if needed) with ATH tracking.');
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

// Validate user balances before spin to ensure they can fulfill their votes
export async function validateUserBalancesBeforeSpin(): Promise<{
    validVotes: Record<string, Vote[]>;
    invalidVotes: Record<string, Vote[]>;
    partialVotes: Record<string, { valid: Vote[], invalid: Vote[] }>;
    validTokenBets: Record<string, number>;
}> {
    try {
        const { getUserTokenBalance } = await import('blaze-sdk');
        const CHARISMA_SUBNET_CONTRACT_ID =
            process.env.NEXT_PUBLIC_CHARISMA_CONTRACT_ID ||
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1';

        const allUserVotes = await getAllUserVotes();
        const validVotes: Record<string, Vote[]> = {};
        const invalidVotes: Record<string, Vote[]> = {};
        const partialVotes: Record<string, { valid: Vote[], invalid: Vote[] }> = {};
        const validTokenBets: Record<string, number> = {};

        console.log('🔍 Validating user balances before spin (complete votes only)...');

        for (const [userId, votes] of Object.entries(allUserVotes)) {
            if (!votes || votes.length === 0) continue;

            try {
                // Get user's current token balance
                const balanceData = await getUserTokenBalance(CHARISMA_SUBNET_CONTRACT_ID, userId);
                const currentBalance = BigInt(balanceData.preconfirmationBalance || '0');

                // Sort votes by time (FIFO - first votes get priority)
                const sortedVotes = [...votes].sort((a, b) => a.voteTime - b.voteTime);

                // Calculate total CHA committed by this user
                const totalCommitted = votes.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);

                console.log(`User ${userId}: Balance ${currentBalance.toString()}, Committed ${totalCommitted}`);

                if (currentBalance >= BigInt(totalCommitted)) {
                    // User has sufficient balance - keep all their votes
                    validVotes[userId] = votes;

                    // Add to valid token bets
                    votes.forEach(vote => {
                        if (!validTokenBets[vote.tokenId]) {
                            validTokenBets[vote.tokenId] = 0;
                        }
                        validTokenBets[vote.tokenId] += vote.voteAmountCHA;
                    });

                    console.log(`✅ User ${userId}: All ${votes.length} votes valid (sufficient balance)`);
                } else if (currentBalance > 0) {
                    // User has partial balance - accept complete votes up to balance limit
                    const userValidVotes: Vote[] = [];
                    const userInvalidVotes: Vote[] = [];
                    let remainingBalance = Number(currentBalance);

                    for (const vote of sortedVotes) {
                        if (remainingBalance >= vote.voteAmountCHA) {
                            // This complete vote can be covered
                            userValidVotes.push(vote);
                            remainingBalance -= vote.voteAmountCHA;

                            // Add to valid token bets
                            if (!validTokenBets[vote.tokenId]) {
                                validTokenBets[vote.tokenId] = 0;
                            }
                            validTokenBets[vote.tokenId] += vote.voteAmountCHA;
                        } else {
                            // This complete vote cannot be covered - reject it entirely
                            userInvalidVotes.push(vote);
                        }
                    }

                    if (userValidVotes.length > 0) {
                        if (userInvalidVotes.length > 0) {
                            // Store partial validation results (some votes accepted, some rejected)
                            partialVotes[userId] = {
                                valid: userValidVotes,
                                invalid: userInvalidVotes
                            };

                            const validAmount = userValidVotes.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);
                            const invalidAmount = userInvalidVotes.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);

                            console.log(`⚖️ User ${userId}: ${userValidVotes.length} votes accepted (${validAmount} CHA), ${userInvalidVotes.length} votes rejected (${invalidAmount} CHA)`);
                        } else {
                            // All votes are valid (this shouldn't happen given the condition above, but just in case)
                            validVotes[userId] = userValidVotes;
                            console.log(`✅ User ${userId}: All ${userValidVotes.length} votes valid`);
                        }
                    } else {
                        // No votes can be covered - reject all
                        invalidVotes[userId] = votes;
                        console.log(`❌ User ${userId}: No votes can be covered (balance too low for any single vote)`);
                    }
                } else {
                    // User has zero balance - invalidate all their votes
                    invalidVotes[userId] = votes;
                    console.log(`❌ User ${userId}: Zero balance, rejecting all ${votes.length} votes`);
                }
            } catch (error) {
                console.error(`❌ Error checking balance for user ${userId}:`, error);
                // On error, invalidate votes to be safe
                invalidVotes[userId] = votes;
            }
        }

        const validUserCount = Object.keys(validVotes).length;
        const invalidUserCount = Object.keys(invalidVotes).length;
        const partialUserCount = Object.keys(partialVotes).length;
        const validTokenCount = Object.keys(validTokenBets).length;

        console.log(`🎯 Balance validation complete:`);
        console.log(`   Fully valid users: ${validUserCount}`);
        console.log(`   Partially valid users: ${partialUserCount}`);
        console.log(`   Invalid users: ${invalidUserCount}`);
        console.log(`   Valid tokens with bets: ${validTokenCount}`);

        return { validVotes, invalidVotes, partialVotes, validTokenBets };
    } catch (error) {
        console.error('Failed to validate user balances:', error);
        // On validation error, return all votes as invalid to be safe
        const allUserVotes = await getAllUserVotes();
        return {
            validVotes: {},
            invalidVotes: allUserVotes,
            partialVotes: {},
            validTokenBets: {}
        };
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

    // Get current round's total for ATH tracking
    const currentBets = await getKVTokenBets();
    const currentRoundTotal = Object.values(currentBets).reduce((sum, amount) => sum + amount, 0);

    // Get winning token and user votes for leaderboard integration
    const winningTokenId = await kv.get<string>(KV_WINNING_TOKEN_ID);

    // Update ATH if current round beats it
    const newATH = await updateATHIfNeeded(currentRoundTotal);

    // Set current round total as previous round amount for next round
    await setPreviousRoundAmount(currentRoundTotal);

    if (newATH) {
        console.log(`🎉 Round completed with NEW ATH: ${currentRoundTotal} CHA!`);
    } else {
        console.log(`Round completed with total: ${currentRoundTotal} CHA (ATH: ${await getATHTotalAmount()} CHA)`);
    }

    // Complete round with leaderboard integration
    if (winningTokenId && winningTokenId !== 'none') {
        console.log(`Round completed with winner: ${winningTokenId}`);

        // Get all user votes to identify winners
        const allUserVotes = await getAllUserVotes();
        const winnerRewards: Record<string, number> = {};

        // Identify users who voted for the winning token
        Object.entries(allUserVotes).forEach(([userId, votes]) => {
            // Check if this user voted for the winning token
            const winningVotes = votes.filter(vote => vote.tokenId === winningTokenId);
            if (winningVotes.length > 0) {
                // For now, set placeholder earnings (real earnings calculated later in /api/multihop/process)
                const totalWinningVoteAmount = winningVotes.reduce((sum, vote) => sum + vote.voteAmountCHA, 0);
                winnerRewards[userId] = totalWinningVoteAmount; // Use vote amount as placeholder
            }
        });

        console.log(`Identified ${Object.keys(winnerRewards).length} winners for token ${winningTokenId}`);

        // Call leaderboard integration with identified winners
        const { completeRoundWithLeaderboard } = await import('./leaderboard-integration');
        await completeRoundWithLeaderboard(winningTokenId, winnerRewards);
    }

    // --- Set new round ID for next round ---
    const newRoundId = `round_${Date.now()}`;
    await kv.set('global:current_round', newRoundId);

    // Now reset/clear token bets and user activity for next round
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

    // Get ATH tracking data
    const athTotalAmount = await getATHTotalAmount();
    const previousRoundAmount = await getPreviousRoundAmount();

    const now = Date.now();

    return {
        type: status.winningTokenId ? 'spin_result' : 'update',
        lastUpdated: now,
        startTime: status.spinScheduledAt - status.roundDuration, // Calculate actual start time
        endTime: status.spinScheduledAt,
        winningTokenId: status.winningTokenId ?? undefined,
        tokenVotes: bets,
        roundDuration: status.roundDuration, // Include round duration in the packet
        lockDuration: lockDuration, // Include lock duration in the packet
        athTotalAmount: athTotalAmount, // Include ATH total amount
        previousRoundAmount: previousRoundAmount // Include previous round amount
    };
}

// Clean invalid intents from multihop queue based on balance validation
export async function cleanInvalidIntentsFromQueue(invalidVotes: Record<string, Vote[]>): Promise<{
    totalIntents: number;
    removedIntents: number;
    remainingIntents: number;
}> {
    try {
        const { kv } = await import('@vercel/kv');
        const TX_QUEUE_KEY = 'meme-roulette-tx-queue';

        // Get all intents from queue
        const allIntents = await kv.lrange(TX_QUEUE_KEY, 0, -1);
        const totalIntents = allIntents.length;

        if (totalIntents === 0) {
            console.log('🧹 No intents in queue to clean');
            return { totalIntents: 0, removedIntents: 0, remainingIntents: 0 };
        }

        // Create set of invalid user addresses for fast lookup
        const invalidUserIds = new Set(Object.keys(invalidVotes));

        // Filter out intents from users with insufficient balances
        const validIntents = allIntents.filter((intent: any) => {
            const intentObj = typeof intent === 'string' ? JSON.parse(intent) : intent;
            const isValid = !invalidUserIds.has(intentObj.recipient);

            if (!isValid) {
                console.log(`🗑️ Removing intent from user ${intentObj.recipient} due to insufficient balance`);
            }

            return isValid;
        });

        const removedIntents = totalIntents - validIntents.length;

        if (removedIntents > 0) {
            // Clear the queue and re-add only valid intents
            await kv.del(TX_QUEUE_KEY);

            if (validIntents.length > 0) {
                // Add valid intents back to queue in reverse order to maintain FIFO
                for (let i = validIntents.length - 1; i >= 0; i--) {
                    await kv.lpush(TX_QUEUE_KEY, validIntents[i]);
                }
            }

            console.log(`🧹 Cleaned queue: removed ${removedIntents} invalid intents, kept ${validIntents.length} valid intents`);
        } else {
            console.log(`✅ Queue clean: all ${totalIntents} intents are valid`);
        }

        return {
            totalIntents,
            removedIntents,
            remainingIntents: validIntents.length
        };
    } catch (error) {
        console.error('Failed to clean invalid intents from queue:', error);
        return { totalIntents: 0, removedIntents: 0, remainingIntents: 0 };
    }
} 