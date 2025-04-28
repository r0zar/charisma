import { NextRequest, NextResponse } from 'next/server';
import { setKVWinningToken } from '@/lib/state';
import { listTokens } from '@/app/actions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tokenId } = body;

        if (!tokenId || typeof tokenId !== 'string') {
            return NextResponse.json(
                { error: 'Invalid tokenId provided' },
                { status: 400 }
            );
        }

        // Validate the token exists using listTokens
        const tokensResult = await listTokens();
        const tokens = tokensResult.success && tokensResult.tokens ? tokensResult.tokens : [];
        const tokenExists = tokens.some(token => token.contractId === tokenId);

        if (!tokenExists) {
            console.warn(`Admin winner API: Token ID ${tokenId} not found in current token list`);
            // Could return an error here, but we'll allow it for maximum flexibility
        }

        await setKVWinningToken(tokenId);

        return NextResponse.json({
            success: true,
            message: `Winner set to token: ${tokenId}`,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Admin winner API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 