import type { SpinFeedData, Token, Vote } from '@/types/spin';
import { kv } from '@vercel/kv'; // Import kv directly if needed for specific checks
import { listTokens } from '@/app/actions';
import {
    initializeKVState,
    getKVLastTokenFetchTime,
    getKVSpinStatus,
    getKVTokenBets,
    setKVWinningToken,
    resetKVForNextSpin,
    buildKVDataPacket,
    TOKEN_REFRESH_INTERVAL,
    UPDATE_INTERVAL, // Get interval constants from state module
    KV_TOKEN_BETS, // Import the KV key for token bets
    getLockDuration,
    getUserVotes // Import the getUserVotes function from the state module
} from '@/lib/state';
import { NextRequest } from 'next/server';

const isDev = process.env.NODE_ENV === 'development';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3010');

// --- Initialization ---
initializeKVState().catch(err => console.error("Initial KV state check/set failed:", err));

// --- Shared Logic (Interval Timer) ---
let intervalId: NodeJS.Timeout | null = null;

// Store controller and userId together
interface ClientController {
    controller: ReadableStreamDefaultController;
    userId: string;
}
const clientControllers = new Set<ClientController>();

// Function to send a data packet to all connected clients
// Now takes the base packet and customizes it per client
const broadcast = async (basePacket: Omit<SpinFeedData, 'currentUserBets' | 'initialTokens'>) => {
    for (const client of clientControllers) {
        try {
            const personalizedPacket: SpinFeedData = {
                ...basePacket,
                type: basePacket.winningTokenId ? 'spin_result' : (basePacket.type || 'update'), // Ensure type is set
                // initialTokens is only for the very first message, not for broadcasts
            };

            if (client.userId && client.userId !== 'anonymous') {
                try {
                    const userVotes: Vote[] = await getUserVotes(client.userId);
                    personalizedPacket.currentUserBets = userVotes;
                } catch (error) {
                    console.error(`API/Stream: Error getting votes for user ${client.userId}:`, error);
                    personalizedPacket.currentUserBets = []; // Send empty if error
                }
            }

            const message = `data: ${JSON.stringify(personalizedPacket)}\n\n`;
            const encodedMessage = new TextEncoder().encode(message);
            client.controller.enqueue(encodedMessage);
        } catch (e) {
            console.error(`API/Stream: Error sending data to client ${client.userId}, removing controller:`, e);
            try { client.controller.error(e); client.controller.close(); } catch { }
            clientControllers.delete(client);
        }
    }

    if (clientControllers.size === 0 && intervalId) {
        console.log('API/Stream: No clients left, stopping interval.');
        clearInterval(intervalId);
        intervalId = null;
    }
};

// Export the broadcast function for use in other route handlers
export { broadcast };

// This function runs periodically, fetches state from KV, updates it, and broadcasts.
const updateAndBroadcast = async () => {
    const now = Date.now();
    let status = await getKVSpinStatus();
    let lastTokenFetch = await getKVLastTokenFetchTime();

    // --- Token Refresh Logic (no longer needed, using listTokens directly) ---

    // --- Game Logic (Based on KV State) ---
    const timeLeft = status.spinScheduledAt - now;

    let needsReset = false;
    if (timeLeft <= 0 && !status.winningTokenId) {
        // Spin finished, determine winner
        // Fetch current tokens from Dexterity instead of KV
        const tokensResult = await listTokens();
        const currentTokens = tokensResult.success && tokensResult.tokens
            ? tokensResult.tokens.map(token => ({
                id: token.contractId,
                name: token.name,
                symbol: token.symbol,
                imageUrl: token.image || '/placeholder-token.png',
                userBalance: 0
            } as Token))
            : [];

        const tokenBets = await getKVTokenBets(); // Get all token bets
        let winnerId: string | null = null;

        // Debug log all current tokens and bets received
        console.log("API/Stream: Current token list:", JSON.stringify(currentTokens.map(t => ({ id: t.id, symbol: t.symbol }))));
        console.log("API/Stream: All token bets received:", JSON.stringify(tokenBets));

        // IMPORTANT: Only consider bets for tokens that actually exist in the current token list
        // This prevents "ghost" tokens from appearing if they're not in the current token list
        const validTokenIds = new Set(currentTokens.map(token => token.id));

        // Check if we have any valid bets at all
        const tokensWithBets = Object.entries(tokenBets)
            .filter(([id, amount]) => {
                const isValid = id !== '_init' &&
                    typeof amount === 'number' &&
                    amount > 0 &&
                    validTokenIds.has(id);

                if (!isValid && id !== '_init') {
                    console.warn(`API/Stream: Ignoring invalid bet for token ${id} (amount: ${amount}, in token list: ${validTokenIds.has(id)})`);
                }

                return isValid;
            })
            .map(([id, amount]) => ({
                id,
                amount: Number(amount),
                symbol: currentTokens.find(t => t.id === id)?.symbol || 'Unknown'
            }));

        console.log("API/Stream: Filtered VALID tokens with bets:", JSON.stringify(tokensWithBets));

        if (tokensWithBets.length > 0) {
            // Calculate total bet amount
            const totalBets = tokensWithBets.reduce((sum, token) => sum + token.amount, 0);
            console.log(`API/Stream: Total valid bets: ${totalBets}`);

            // Log the percentage chance for each token
            tokensWithBets.forEach(token => {
                const percentage = (token.amount / totalBets) * 100;
                console.log(`API/Stream: Token ${token.id} (${token.symbol}) has ${token.amount} bets (${percentage.toFixed(2)}% chance)`);
            });

            // For extra randomness, shuffle the tokens first
            const shuffledTokens = [...tokensWithBets].sort(() => Math.random() - 0.5);

            // Generate a random point along the total bet amount
            const randomValue = Math.random();
            const randomPoint = randomValue * totalBets;
            console.log(`API/Stream: Random value: ${randomValue}, random point: ${randomPoint}`);

            // Find which token's bet range contains this point
            let cumulativeBet = 0;
            for (const token of shuffledTokens) {
                const prevCumulative = cumulativeBet;
                cumulativeBet += token.amount;
                console.log(`API/Stream: Token ${token.id} (${token.symbol}) range: ${prevCumulative} to ${cumulativeBet}`);

                if (randomPoint <= cumulativeBet) {
                    winnerId = token.id;
                    console.log(`API/Stream: Selected token ${token.id} (${token.symbol}) because ${randomPoint} <= ${cumulativeBet}`);
                    break;
                }
            }

            // Double-check the winner exists in the current token list
            if (winnerId && !validTokenIds.has(winnerId)) {
                console.error(`API/Stream: CRITICAL ERROR - Selected winner ${winnerId} is not in current token list!`);
                // Fallback to highest bet valid token
                const highestBetToken = tokensWithBets.reduce((max, token) =>
                    token.amount > max.amount ? token : max, tokensWithBets[0]);
                winnerId = highestBetToken.id;
                console.log(`API/Stream: Fallback selection - highest bet valid token ${winnerId} (${highestBetToken.symbol})`);
            }

            // If somehow no token was selected (shouldn't happen), select based on highest bet
            if (!winnerId && shuffledTokens.length > 0) {
                const highestBetToken = shuffledTokens.reduce((max, token) =>
                    token.amount > max.amount ? token : max, shuffledTokens[0]);
                winnerId = highestBetToken.id;
                console.log(`API/Stream: Fallback selection - highest bet token ${winnerId} (${highestBetToken.symbol})`);
            }

            console.log(`API/Stream: Spin finished, winning token: ${winnerId} (weighted selection from ${tokensWithBets.length} tokens with bets)`);
        } else if (currentTokens.length > 0) {
            // If no valid bets, select a random token from the current token list
            const randomIndex = Math.floor(Math.random() * currentTokens.length);
            winnerId = currentTokens[randomIndex].id;
            console.log(`API/Stream: No valid bets found, selecting random token from current list. Winning token: ${winnerId} (${currentTokens[randomIndex].symbol})`);
        } else {
            console.log(`API/Stream: Spin finished, but no tokens available to select a winner.`);
            winnerId = 'none';
        }

        // Verify winner token exists before setting
        if (winnerId && winnerId !== 'none') {
            const winnerExists = currentTokens.some(token => token.id === winnerId);
            if (!winnerExists) {
                console.error(`API/Stream: ERROR - Cannot set winner to ${winnerId} as it does not exist in current token list`);
                // Emergency fallback - pick first token in list
                winnerId = currentTokens.length > 0 ? currentTokens[0].id : 'none';
                console.log(`API/Stream: Emergency fallback - setting winner to ${winnerId}`);
            }
        }

        await setKVWinningToken(winnerId);
        status.winningTokenId = winnerId; // Update local copy for broadcast
        // Trigger execution of queued intents now that winner is determined
        try {
            console.log({ BASE_URL })
            await fetch(`${BASE_URL}/api/multihop/process`, { method: 'POST' });
            console.log('API/Stream: Triggered processing of queued intents.');
        } catch (e) {
            console.error('API/Stream: Failed to trigger intent processing:', e);
        }

        // Ensure status.winningTokenId is updated locally after setKVWinningToken for the current broadcast
        const updatedStatusAfterWin = await getKVSpinStatus(); // Re-fetch status to get the winner ID just set
        status.winningTokenId = updatedStatusAfterWin.winningTokenId;

    } else if (status.winningTokenId && timeLeft <= -60000) {
        console.log('API/Stream: Resetting KV for next spin (after 60s delay)');

        // Make sure the token bets hash is completely cleared
        try {
            const beforeReset = await getKVTokenBets();
            console.log('API/Stream: Token bets before reset:', JSON.stringify(beforeReset));

            await resetKVForNextSpin();

            const afterReset = await getKVTokenBets();
            console.log('API/Stream: Token bets after reset:', JSON.stringify(afterReset));

            // Double-check that reset worked
            const tokensWithBets = Object.entries(afterReset)
                .filter(([id, amount]) => id !== '_init' && Number(amount) > 0);

            if (tokensWithBets.length > 0) {
                console.error('API/Stream: ERROR - Token bets were not properly cleared after reset!');
                // Force clear the bets again if they weren't cleared
                await kv.del(KV_TOKEN_BETS);
                await kv.hset(KV_TOKEN_BETS, { '_init': '1' });
            }
        } catch (error) {
            console.error('API/Stream: Error during reset:', error);
        }

        needsReset = true;
        // Fetch the *new* status after reset if we need to broadcast it immediately
        // (buildKVDataPacket will fetch the latest bets/status anyway)
    }

    // --- Broadcast --- 
    // Build packet with current bets and status (no initialTokens here)
    const currentBets = await getKVTokenBets();
    const currentStatus = await getKVSpinStatus(); // re-fetch status for most up-to-date endTime etc.
    const lockDuration = await getLockDuration();

    const basePacket: Omit<SpinFeedData, 'currentUserBets' | 'initialTokens'> = {
        type: currentStatus.winningTokenId ? 'spin_result' : 'update',
        startTime: currentStatus.spinScheduledAt - currentStatus.roundDuration,
        endTime: currentStatus.spinScheduledAt,
        tokenVotes: currentBets,
        winningTokenId: currentStatus.winningTokenId ?? undefined,
        lastUpdated: Date.now(),
        roundDuration: currentStatus.roundDuration,
        lockDuration: lockDuration,
    };

    await broadcast(basePacket); // Pass the base packet
};

// --- Interval Management ---
const startInterval = () => {
    if (!intervalId) {
        console.log('API/Stream: Starting global update/broadcast interval.');
        updateAndBroadcast().catch(err => console.error("Initial broadcast failed (from startInterval):", err));
        intervalId = setInterval(() => {
            updateAndBroadcast().catch(err => console.error("Broadcast interval update failed:", err));
        }, UPDATE_INTERVAL);
    }
};

// --- Route Handler ---
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'anonymous';
    let currentClient: ClientController | null = null;

    console.log(`API/Stream: Connection from user ${userId}`);

    const stream = new ReadableStream({
        async start(controller) {
            currentClient = { controller, userId };
            console.log(`API/Stream: Client ${userId} connected`);
            clientControllers.add(currentClient);

            try {
                const tokensResult = await listTokens();
                const initialTokens = tokensResult.success && tokensResult.tokens
                    ? tokensResult.tokens.map(token => ({
                        id: token.contractId,
                        name: token.name,
                        symbol: token.symbol,
                        imageUrl: token.image || '/placeholder-token.png',
                        userBalance: 0 // This was always 0, so it's fine
                    } as Token))
                    : [];

                const initialStatus = await getKVSpinStatus();
                const initialBets = await getKVTokenBets();
                const lockDuration = await getLockDuration();
                const currentUserVotes = userId !== 'anonymous' ? await getUserVotes(userId) : [];

                const initialDataPacket: SpinFeedData = {
                    type: initialStatus.winningTokenId ? 'spin_result' : 'initial',
                    initialTokens: initialTokens,
                    startTime: initialStatus.spinScheduledAt - initialStatus.roundDuration,
                    endTime: initialStatus.spinScheduledAt,
                    tokenVotes: initialBets,
                    winningTokenId: initialStatus.winningTokenId ?? undefined,
                    lastUpdated: Date.now(),
                    roundDuration: initialStatus.roundDuration,
                    lockDuration: lockDuration,
                    currentUserBets: currentUserVotes
                };
                const message = `data: ${JSON.stringify(initialDataPacket)}\n\n`;
                controller.enqueue(new TextEncoder().encode(message));
                console.log(`API/Stream: Sent initial state to ${userId} with ${initialTokens.length} tokens, ${Object.keys(initialBets).length} bet entries, and ${currentUserVotes.length} user votes.`);
            } catch (e) {
                console.error(`API/Stream: Error sending initial data to ${userId}:`, e);
                if (currentClient) {
                    try { currentClient.controller.error(e); currentClient.controller.close(); } catch { }
                    clientControllers.delete(currentClient);
                }
                return;
            }
            startInterval(); // No longer passes userId
        },
        cancel(reason) {
            console.log(`API/Stream: Client ${userId} disconnected (cancelled)`, reason);
            if (currentClient) {
                clientControllers.delete(currentClient);
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        },
    });
}

// Ensure dynamic execution
export const dynamic = 'force-dynamic';

// Add the Edge runtime config
export const config = {
    runtime: 'edge',
}; 