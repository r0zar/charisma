import { type NextRequest, NextResponse } from 'next/server';
import { incrementKVTokenBet, recordUserVote } from '@/lib/state';
import { listTokens } from '@/app/actions';

interface PlaceBetRequestBody {
    tokenId: string;
    chaAmount: number;
    userId?: string; // Add optional userId field
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as PlaceBetRequestBody;
        const { tokenId, chaAmount, userId = 'anonymous' } = body; // Default to 'anonymous' if no userId provided

        if (!tokenId || typeof tokenId !== 'string' || typeof chaAmount !== 'number' || chaAmount <= 0) {
            return NextResponse.json({ success: false, error: 'Invalid bet data' }, { status: 400 });
        }

        // Validate token exists
        const tokensResult = await listTokens();
        const tokens = tokensResult.success && tokensResult.tokens ? tokensResult.tokens : [];
        const tokenExists = tokens.some(token => token.contractId === tokenId);

        if (!tokenExists) {
            console.warn(`API/PlaceBet: Token ID ${tokenId} not found in current token list`);
            return NextResponse.json({
                success: false,
                error: 'Token not found in available tokens list'
            }, { status: 400 });
        }

        // Increment the value for the specific token in the KV hash
        console.log(`API/PlaceBet: Received bet of ${chaAmount} CHA for ${tokenId} from user ${userId}. Attempting increment...`);
        const newAmountForToken = await incrementKVTokenBet(tokenId, chaAmount);

        if (newAmountForToken === null) {
            // Handle potential error from incrementKVTokenBet (e.g., invalid input, KV error)
            console.error(`API/PlaceBet: Failed to increment bet for token ${tokenId}.`);
            return NextResponse.json({ success: false, error: 'Failed to record bet' }, { status: 500 });
        }

        // Record the user's vote
        const vote = await recordUserVote(userId, tokenId, chaAmount);

        console.log(`API/PlaceBet: New total for ${tokenId} in KV: ${newAmountForToken}`);
        // Note: The SSE stream will reflect this on its next broadcast.

        return NextResponse.json({
            success: true,
            message: 'Bet placed successfully',
            voteId: vote?.id
        });

    } catch (error) {
        console.error("API/PlaceBet Error:", error);
        let errorMessage = 'Failed to place bet';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}

// Add OPTIONS handler for CORS preflight requests if needed during development
// (especially if frontend/API are on different ports accidentally)
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*', // Or specific origin
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
} 