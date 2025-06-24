import { NextRequest, NextResponse } from 'next/server';
import { makeSTXTokenTransfer, broadcastTransaction, AnchorMode, PostConditionMode } from '@stacks/transactions';
import { ADMIN_ADDRESS, BLAZE_SIGNER_PRIVATE_KEY } from '@/lib/constants';

export async function POST(req: NextRequest) {
    try {
        // Only allow in development environment
        if (process.env.NODE_ENV !== 'development') {
            return NextResponse.json({ error: 'Debug endpoint only available in development' }, { status: 403 });
        }

        const { nonce } = await req.json();
        
        if (!BLAZE_SIGNER_PRIVATE_KEY) {
            return NextResponse.json({ error: 'Private key not configured' }, { status: 500 });
        }

        console.log(`[Nonce Fill] Filling nonce: ${nonce}`);

        // Create a 1 microSTX transfer with the exact nonce specified
        const txOptions = {
            recipient: ADMIN_ADDRESS,
            amount: 1, // 1 microSTX
            senderKey: BLAZE_SIGNER_PRIVATE_KEY,
            network: 'mainnet' as const,
            memo: `Nonce fill ${nonce}`,
            nonce: nonce,
            anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Allow
        };

        const transaction = await makeSTXTokenTransfer(txOptions);
        const broadcastResponse = await broadcastTransaction({ transaction });

        console.log(`[Nonce Fill] Nonce ${nonce} sent, txid: ${broadcastResponse.txid}`);

        return NextResponse.json({
            success: true,
            nonce: nonce,
            txid: broadcastResponse.txid
        });

    } catch (error) {
        console.error(`[Nonce Fill] Error:`, error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}