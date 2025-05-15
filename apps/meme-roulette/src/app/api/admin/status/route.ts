import { NextResponse } from 'next/server';
import {
    getKVSpinStatus,
    getKVTokenBets,
    getKVLastTokenFetchTime
} from '@/lib/state';
import { listTokens } from 'dexterity-sdk';

export async function GET() {
    try {
        // Fetch state data and tokens in parallel
        const [spinStatus, tokenBets, lastTokenFetch, tokensResult] = await Promise.all([
            getKVSpinStatus(),
            getKVTokenBets(),
            getKVLastTokenFetchTime(),
            listTokens() // Use the listTokens function from actions.ts
        ]);

        // Extract tokens from the result of listTokens
        const tokens = tokensResult;

        return NextResponse.json({
            spinStatus,
            tokens,
            tokenBets,
            lastTokenFetch,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Admin status API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 