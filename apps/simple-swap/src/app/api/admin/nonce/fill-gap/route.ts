import { NextRequest, NextResponse } from 'next/server';
import { makeContractCall, broadcastTransaction, AnchorMode, PostConditionMode, uintCV } from '@stacks/transactions';
import { STACKS_MAINNET } from '@stacks/network';
import { ADMIN_ADDRESS, BLAZE_SIGNER_PRIVATE_KEY, BLAZE_SOLVER_ADDRESS } from '@/lib/constants';

// POST /api/admin/nonce/fill-gap - Submit a transaction with specific nonce to fill gap
export async function POST(request: NextRequest) {
    // Only allow in development environment
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({
            success: false,
            error: 'This endpoint is only available in development mode'
        }, { status: 403 });
    }

    try {
        const { nonce, contractAddress, contractName, functionName, args } = await request.json();

        if (!nonce || typeof nonce !== 'number') {
            return NextResponse.json({
                success: false,
                error: 'Missing or invalid nonce parameter'
            }, { status: 400 });
        }

        console.log(`[Fill Gap API] Creating transaction with nonce ${nonce} to fill gap`);

        // Create a state-changing transaction to actually consume the nonce
        // Using STX transfer to user wallet
        const { makeSTXTokenTransfer } = await import('@stacks/transactions');

        const txOptions = {
            recipient: ADMIN_ADDRESS, // User wallet ending in 55KS
            amount: 1, // 1 STX 
            senderKey: BLAZE_SIGNER_PRIVATE_KEY!,
            network: STACKS_MAINNET,
            anchorMode: AnchorMode.Any,
            nonce: nonce,
            memo: `Nonce gap fill: ${nonce}`
        };

        console.log(`[Fill Gap API] Creating STX transfer to user wallet to consume nonce ${nonce}`);

        console.log(`[Fill Gap API] Transaction options:`, {
            recipient: txOptions.recipient,
            amount: `${txOptions.amount} microSTX`,
            nonce: txOptions.nonce,
            memo: txOptions.memo
        });

        // Create and broadcast the transaction
        const transaction = await makeSTXTokenTransfer(txOptions);
        const broadcastResult = await broadcastTransaction({
            transaction,
            network: STACKS_MAINNET
        });

        console.log(`[Fill Gap API] Broadcast result:`, broadcastResult);

        if ((broadcastResult as any).error) {
            return NextResponse.json({
                success: false,
                error: `Transaction failed: ${(broadcastResult as any).error}`,
                details: broadcastResult
            }, { status: 400 });
        }

        const txId = broadcastResult.txid || broadcastResult;

        console.log(`[Fill Gap API] ✅ Successfully submitted gap-filling transaction`);
        console.log(`[Fill Gap API] Transaction ID: ${txId}`);
        console.log(`[Fill Gap API] Nonce: ${nonce}`);

        return NextResponse.json({
            success: true,
            message: `Successfully submitted transaction with nonce ${nonce}`,
            data: {
                txId: txId,
                nonce: nonce,
                type: 'STX Transfer',
                recipient: txOptions.recipient,
                amount: `${txOptions.amount} microSTX (1 STX)`,
                memo: txOptions.memo,
                explorerUrl: `https://explorer.stacks.co/txid/${txId}?chain=mainnet`
            }
        }, { status: 200 });

    } catch (error) {
        console.error('[Fill Gap API] Error submitting gap-filling transaction:', error);
        return NextResponse.json({
            success: false,
            error: `Failed to submit transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 });
    }
}

// GET /api/admin/nonce/fill-gap - Get instructions for filling gap
export async function GET(request: NextRequest) {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({
            success: false,
            error: 'This endpoint is only available in development mode'
        }, { status: 403 });
    }

    return NextResponse.json({
        success: true,
        message: 'Use POST to submit a gap-filling transaction',
        usage: {
            endpoint: 'POST /api/admin/nonce/fill-gap',
            required: {
                nonce: 'number - The specific nonce to use (e.g., 357)'
            },
            optional: {
                amount: 'number - microSTX amount to transfer (defaults to 1)',
                memo: 'string - Transaction memo'
            },
            example: {
                nonce: 357,
                note: 'Will create a minimal STX transfer to self to consume the nonce'
            }
        }
    }, { status: 200 });
}