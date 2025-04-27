import { NextResponse } from 'next/server';
import {
    setKVSpinScheduledAt,
    setKVWinningToken,
    getKVTokens, // Import getKVTokens to find a mock winner
    getKVTokenBets // Import getKVTokenBets to pick a token with bets
} from '@/app/api/stream/state.ts'; // Try path alias

export async function POST(request: Request) {
    // IMPORTANT: Only allow in development
    if (process.env.NODE_ENV !== 'development') {
        return new NextResponse('Forbidden', { status: 403 });
    }

    try {
        const { desiredState } = await request.json();
        const now = Date.now();

        if (!desiredState || !['OPEN', 'LOCKED', 'COMPLETED'].includes(desiredState)) {
            return NextResponse.json({ error: 'Invalid desiredState specified' }, { status: 400 });
        }

        console.log(`DEV API: Setting state to ${desiredState}`);

        switch (desiredState) {
            case 'OPEN':
                await setKVSpinScheduledAt(now + 600000); // 10 minutes in future
                await setKVWinningToken(null);
                break;
            case 'LOCKED':
                await setKVSpinScheduledAt(now + 5000); // 5s in future
                await setKVWinningToken(null);
                break;
            case 'COMPLETED':
                await setKVSpinScheduledAt(now - 10000); // 10s in past

                // Get both tokens and current bets
                const tokens = await getKVTokens();
                const tokenBets = await getKVTokenBets();

                // Find tokens with bets
                const tokensWithBets = Object.entries(tokenBets)
                    .filter(([id, amount]) => {
                        // Filter out _init and ensure valid number amounts > 0
                        return id !== '_init' && typeof amount === 'number' && amount > 0;
                    })
                    .map(([id, amount]) => ({
                        id,
                        amount: Number(amount)
                    }));

                console.log('DEV API: Tokens with bets:', tokensWithBets);

                let mockWinnerId: string;

                if (tokensWithBets.length > 0) {
                    // Sort by bet amount (highest first)
                    tokensWithBets.sort((a, b) => b.amount - a.amount);

                    // Pick highest bet token as winner
                    mockWinnerId = tokensWithBets[0].id;
                    console.log(`DEV API: Setting winner to highest bet token: ${mockWinnerId} (${tokensWithBets[0].amount} bets)`);
                } else if (tokens.length > 0) {
                    // Fallback to first token if no bets
                    mockWinnerId = tokens[0].id;
                    console.log(`DEV API: No tokens with bets, falling back to first token: ${mockWinnerId}`);
                } else {
                    // Emergency fallback
                    mockWinnerId = 'mock-token-id';
                    console.log(`DEV API: No tokens available, using mock ID: ${mockWinnerId}`);
                }

                await setKVWinningToken(mockWinnerId);
                break;
        }

        return NextResponse.json({ success: true, stateSet: desiredState });

    } catch (error) {
        console.error("DEV API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 