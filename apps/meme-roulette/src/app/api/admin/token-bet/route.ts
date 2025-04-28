import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getKVTokenBets, KV_TOKEN_BETS } from '@/lib/state';
import { listTokens } from '@/app/actions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tokenId, amount } = body;

        // Validate inputs
        if (!tokenId || typeof tokenId !== 'string') {
            return NextResponse.json(
                { error: 'Invalid tokenId provided' },
                { status: 400 }
            );
        }

        if (typeof amount !== 'number' || isNaN(amount)) {
            return NextResponse.json(
                { error: 'Invalid amount provided - must be a number' },
                { status: 400 }
            );
        }

        // Optional: Validate token exists if we're adding/updating
        if (amount > 0) {
            const tokensResult = await listTokens();
            const tokens = tokensResult.success && tokensResult.tokens ? tokensResult.tokens : [];
            const tokenExists = tokens.some(token => token.contractId === tokenId);

            if (!tokenExists) {
                console.warn(`Admin token-bet API: Token ID ${tokenId} not found in current token list, but proceeding anyway`);
            }
        }

        // Instead of incrementing, we'll directly set the amount
        // This allows us to both increase and decrease the bet amount
        const beforeUpdate = await getKVTokenBets();
        console.log(`Admin token-bet API: Before update, token ${tokenId} had ${beforeUpdate[tokenId] || 0} CHA`);

        // If amount is 0, remove the token from the hash
        if (amount === 0) {
            await kv.hdel(KV_TOKEN_BETS, tokenId);
            console.log(`Admin token-bet API: Removed token ${tokenId} from bets`);
        } else {
            // Otherwise, set the new amount directly
            await kv.hset(KV_TOKEN_BETS, { [tokenId]: amount });
            console.log(`Admin token-bet API: Set token ${tokenId} bet to ${amount} CHA`);
        }

        const afterUpdate = await getKVTokenBets();

        return NextResponse.json({
            success: true,
            message: `Token ${tokenId} bet ${amount === 0 ? 'removed' : `set to ${amount}`}`,
            tokenBets: afterUpdate,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Admin token-bet API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 