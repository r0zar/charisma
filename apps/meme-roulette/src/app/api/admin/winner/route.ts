import { NextRequest, NextResponse } from 'next/server';
import { setKVWinningToken } from '@/lib/state';
import { listTokens } from 'dexterity-sdk';
import { verifySignatureAndGetSigner } from 'blaze-sdk';

export async function POST(request: NextRequest) {
    const verificationResult = await verifySignatureAndGetSigner(request, {
        message: 'Set winner',
    });

    if (verificationResult.signer !== 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS') {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }
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
        const tokens = await listTokens();
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