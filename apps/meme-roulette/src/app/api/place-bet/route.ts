import { type NextRequest, NextResponse } from 'next/server';
import { buildKVDataPacket } from '@/lib/state';
import { recordVoteWithLeaderboard } from '@/lib/leaderboard-integration';
import { listTokens } from 'dexterity-sdk';
import type { SpinFeedData } from '@/types/spin';

interface PlaceBetRequestBody {
    tokenId: string;
    chaAmount: number;
    userId?: string; // Add optional userId field
}

// Function to broadcast a new vote to all connected clients
const broadcastNewVote = async (tokenId: string, amount: number, voteId: string, userId: string) => {
    try {
        // Get the base data packet
        const basePacket = await buildKVDataPacket();

        // Fetch tokens for the notification
        const tokens = await listTokens();
        const initialTokens = tokens.map(token => ({
            id: token.contractId,
            name: token.name,
            symbol: token.symbol,
            imageUrl: token.image || '/placeholder-token.png',
            decimals: token.decimals,
            userBalance: 0,
            type: token.type,
            contractId: token.contractId
        }))

        // Create the new vote notification
        const newVotePacket: SpinFeedData = {
            ...basePacket,
            type: 'new_vote',
            initialTokens,
            newVote: {
                voteId,
                tokenId,
                amount,
                timestamp: Date.now(),
                userId
            }
        };

        // Get the broadcast function from the stream route
        // This is a dynamic import to avoid circular dependencies
        const streamModule = await import('../stream/route');
        if (typeof streamModule.broadcast === 'function') {
            await streamModule.broadcast(newVotePacket);
            console.log(`API/PlaceBet: Broadcasted new vote notification for ${tokenId} (${amount} CHA) from user ${userId}`);
        } else {
            console.error("API/PlaceBet: Failed to broadcast new vote - broadcast function not found");
        }
    } catch (error) {
        console.error("API/PlaceBet: Error broadcasting new vote:", error);
    }
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as PlaceBetRequestBody;
        const { tokenId, chaAmount, userId = 'anonymous' } = body; // Default to 'anonymous' if no userId provided

        if (!tokenId || typeof tokenId !== 'string' || typeof chaAmount !== 'number' || chaAmount <= 0) {
            return NextResponse.json({ success: false, error: 'Invalid bet data' }, { status: 400 });
        }

        // Validate token exists
        const tokens = await listTokens();
        const tokenExists = tokens.some(token => token.contractId === tokenId);

        if (!tokenExists) {
            console.warn(`API/PlaceBet: Token ID ${tokenId} not found in current token list`);
            return NextResponse.json({
                success: false,
                error: 'Token not found in available tokens list'
            }, { status: 400 });
        }

        // Record the user's vote - this will also increment the token bet internally
        console.log(`API/PlaceBet: Received bet of ${chaAmount} CHA for ${tokenId} from user ${userId}. Recording vote...`);
        const voteResult = await recordVoteWithLeaderboard(userId, tokenId, chaAmount);

        if (!voteResult.vote) {
            // Handle potential error from vote recording
            console.error(`API/PlaceBet: Failed to record vote for token ${tokenId}.`);
            return NextResponse.json({ success: false, error: 'Failed to record bet' }, { status: 500 });
        }

        console.log(`API/PlaceBet: Vote recorded successfully for ${tokenId}`);

        // Broadcast the new vote to all connected clients
        if (voteResult.vote) {
            await broadcastNewVote(tokenId, chaAmount, voteResult.vote.id, userId);

            // Log achievements if any were earned
            if (voteResult.achievements.length > 0) {
                console.log(`API/PlaceBet: User ${userId} earned ${voteResult.achievements.length} new achievements`);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Bet placed successfully',
            voteId: voteResult.vote?.id
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