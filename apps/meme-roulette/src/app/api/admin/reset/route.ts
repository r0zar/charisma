import { NextRequest, NextResponse } from 'next/server';
import { resetKVForNextSpin } from '@/lib/state';
import { verifySignatureAndGetSigner } from 'blaze-sdk';

export async function POST(request: NextRequest) {
    try {
        const verificationResult = await verifySignatureAndGetSigner(request, {
            message: 'Reset spin',
        });

        if (verificationResult.signer !== 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        await resetKVForNextSpin();
        return NextResponse.json({
            success: true,
            message: 'Spin reset successfully',
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Admin reset API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 