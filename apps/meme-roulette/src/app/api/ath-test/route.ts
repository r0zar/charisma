import { NextRequest, NextResponse } from 'next/server';
import {
    getATHTotalAmount,
    setATHTotalAmount,
    getPreviousRoundAmount,
    setPreviousRoundAmount,
    updateATHIfNeeded,
    getKVTokenBets
} from '@/lib/state';

// Test endpoint for ATH tracking functionality
export async function GET(request: NextRequest) {
    try {
        const currentATH = await getATHTotalAmount();
        const previousRound = await getPreviousRoundAmount();
        const currentBets = await getKVTokenBets();
        const currentRoundTotal = Object.values(currentBets).reduce((sum, amount) => sum + amount, 0);

        return NextResponse.json({
            status: 'success',
            data: {
                currentATH,
                previousRound,
                currentRoundTotal,
                currentBets,
                isNewATH: currentRoundTotal > currentATH
            }
        });
    } catch (error) {
        console.error('ATH test endpoint error:', error);
        return NextResponse.json({
            status: 'error',
            message: 'Failed to fetch ATH data'
        }, { status: 500 });
    }
}

// Test endpoint to manually set ATH values (for testing only)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, amount } = body;

        switch (action) {
            case 'setATH':
                await setATHTotalAmount(amount);
                return NextResponse.json({
                    status: 'success',
                    message: `ATH set to ${amount}`
                });

            case 'setPreviousRound':
                await setPreviousRoundAmount(amount);
                return NextResponse.json({
                    status: 'success',
                    message: `Previous round set to ${amount}`
                });

            case 'updateATH':
                const currentBets = await getKVTokenBets();
                const currentTotal = Object.values(currentBets).reduce((sum, amount) => sum + amount, 0);
                const wasUpdated = await updateATHIfNeeded(currentTotal);
                return NextResponse.json({
                    status: 'success',
                    message: `ATH ${wasUpdated ? 'updated' : 'not updated'}`,
                    currentTotal,
                    wasNewATH: wasUpdated
                });

            default:
                return NextResponse.json({
                    status: 'error',
                    message: 'Invalid action. Use: setATH, setPreviousRound, or updateATH'
                }, { status: 400 });
        }
    } catch (error) {
        console.error('ATH test POST endpoint error:', error);
        return NextResponse.json({
            status: 'error',
            message: 'Failed to process ATH test request'
        }, { status: 500 });
    }
} 