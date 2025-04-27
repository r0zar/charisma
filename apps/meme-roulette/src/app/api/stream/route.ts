import type { SpinFeedData, Token } from '@/types/spin';
import { listTokens, TokenCacheData } from '@repo/tokens'; // Import from the package
import { kv } from '@vercel/kv'; // Import kv directly if needed for specific checks
import {
    initializeKVState,
    fetchAndSetKVTokens,
    getKVTokens,
    getKVLastTokenFetchTime,
    getKVSpinStatus,
    getKVTokenBets,
    setKVWinningToken,
    resetKVForNextSpin,
    buildKVDataPacket,
    TOKEN_REFRESH_INTERVAL,
    UPDATE_INTERVAL, // Get interval constants from state module
    KV_TOKEN_BETS // Import the KV key for token bets
} from './state';

// Base URL for token images if they are relative paths in the cache data
const TOKEN_CACHE_API_BASE_URL = process.env.NODE_ENV === 'production' ? 'https://charisma-token-cache.vercel.app' : 'http://localhost:3000';

// Helper to map TokenCacheData to our frontend Token type
const mapTokenCacheToToken = (cacheToken: TokenCacheData): Token => {
    let imageUrl = cacheToken.image || '/placeholder-token.png'; // Default placeholder
    // Check if imageUrl is relative and needs the base URL prefix
    if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
        // Assuming relative path needs base URL. Adjust if cache service provides full URLs.
        // This check might need refinement based on actual image URL format from cache
        console.warn(`Token image URL for ${cacheToken.symbol} might be relative: ${imageUrl}. Attempting to prefix with base URL.`);
        imageUrl = `${TOKEN_CACHE_API_BASE_URL}/${imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl}`;
    } else if (imageUrl && imageUrl.startsWith('/')) {
        // If it starts with '/', assume it's relative to the *meme-roulette* app's public dir (less likely for external service)
        // Keep it as is for now, but might need adjustment.
    }

    return {
        id: cacheToken.contract_principal!, // Use contract_principal as unique ID (verify this field is reliable)
        name: cacheToken.name,
        symbol: cacheToken.symbol,
        imageUrl: imageUrl,
        userBalance: 0,
    };
};

// --- Initialization ---
initializeKVState().catch(err => console.error("Initial KV state check/set failed:", err));
fetchAndSetKVTokens().catch(err => console.error("Initial KV token fetch failed:", err));

// --- Shared Logic (Interval Timer) ---
let intervalId: NodeJS.Timeout | null = null;
const controllers = new Set<ReadableStreamDefaultController>();

// Function to send a data packet to all connected clients
const broadcast = (packet: SpinFeedData) => {
    const message = `data: ${JSON.stringify(packet)}\n\n`;
    const encodedMessage = new TextEncoder().encode(message);

    controllers.forEach(controller => {
        try {
            controller.enqueue(encodedMessage);
        } catch (e) {
            console.error("API/Stream: Error sending data to client, removing controller:", e);
            try { controller.error(e); controller.close(); } catch { }
            controllers.delete(controller);
        }
    });

    // Stop interval if no clients left
    if (controllers.size === 0 && intervalId) {
        console.log('API/Stream: No clients left, stopping interval.');
        clearInterval(intervalId);
        intervalId = null;
    }
};

// This function runs periodically, fetches state from KV, updates it, and broadcasts.
const updateAndBroadcast = async () => {
    const now = Date.now();
    let status = await getKVSpinStatus();
    let lastTokenFetch = await getKVLastTokenFetchTime();

    // --- Token Refresh Logic ---
    if (now - lastTokenFetch > TOKEN_REFRESH_INTERVAL) {
        await fetchAndSetKVTokens(); // This updates tokens and fetch time in KV
        // No need to re-fetch status here unless tokens affect spin logic (they don't currently)
    }

    // --- Game Logic (Based on KV State) ---
    const timeLeft = status.spinScheduledAt - now;

    let needsReset = false;
    if (timeLeft <= 0 && !status.winningTokenId) {
        // Spin finished, determine winner
        const currentTokens = await getKVTokens(); // Fetch tokens only when needed for winner selection
        const tokenBets = await getKVTokenBets(); // Get all token bets
        let winnerId: string | null = null;

        // Debug log all current tokens and bets received
        console.log("API/Stream: Current token list:", JSON.stringify(currentTokens.map(t => ({ id: t.id, symbol: t.symbol }))));
        console.log("API/Stream: All token bets received:", JSON.stringify(tokenBets));

        // IMPORTANT: Only consider bets for tokens that actually exist in the current token list
        // This prevents "ghost" tokens like DMG from appearing if they're not in the current token list
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
    const dataPacket = await buildKVDataPacket();
    broadcast(dataPacket); // Use the broadcast helper
};

// --- Interval Management ---
const startInterval = () => {
    if (!intervalId) {
        console.log('API/Stream: Starting global update/broadcast interval.');
        updateAndBroadcast().catch(err => console.error("Initial broadcast failed:", err));
        intervalId = setInterval(() => {
            updateAndBroadcast().catch(err => console.error("Broadcast interval update failed:", err));
        }, UPDATE_INTERVAL);
    }
};

// --- Route Handler ---
export async function GET() {
    let currentController: ReadableStreamDefaultController | null = null;

    const stream = new ReadableStream({
        async start(controller) {
            currentController = controller;
            console.log('API/Stream: Client connected');
            controllers.add(currentController);

            // --- Send Initial State --- 
            try {
                // Fetch all necessary initial data
                const initialTokens = await getKVTokens();
                const initialStatus = await getKVSpinStatus();
                const initialBets = await getKVTokenBets();

                // Construct the initial packet including tokens
                const initialDataPacket: SpinFeedData = {
                    type: initialStatus.winningTokenId ? 'spin_result' : 'initial',
                    initialTokens: initialTokens,
                    startTime: Date.now() - 1000, // Just for type compatibility, not used in this context
                    endTime: initialStatus.spinScheduledAt,
                    tokenVotes: initialBets,
                    winningTokenId: initialStatus.winningTokenId ?? undefined,
                    lastUpdated: Date.now(),
                };

                const message = `data: ${JSON.stringify(initialDataPacket)}\n\n`;
                controller.enqueue(new TextEncoder().encode(message));
                console.log(`API/Stream: Sent initial state with ${initialTokens.length} tokens and ${Object.keys(initialBets).length} bet entries.`);
            } catch (e) {
                console.error("API/Stream: Error sending initial data:", e);
                try { if (currentController) { currentController.error(e); currentController.close(); } } catch { }
                if (currentController) controllers.delete(currentController);
                return;
            }

            // Ensure the global interval is running for subsequent updates
            startInterval();
        },
        cancel(reason) {
            console.log('API/Stream: Client disconnected (cancelled)', reason);
            if (currentController) {
                controllers.delete(currentController);
            }
            // Interval stop logic is handled within broadcast check
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