import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { callReadOnlyFunction } from '@repo/polyglot';
import { principalCV, stringAsciiCV, uintCV, optionalCVOf, noneCV } from '@stacks/transactions';
import { bufferFromHex } from '@stacks/transactions/dist/cl';
import { incrementKVTokenBet, recordUserVote } from '@/lib/state';
import { listTokens } from '@/app/actions';

// Load environment constants
const TX_QUEUE_KEY = 'meme-roulette-tx-queue';

// Expected request shape
interface QueueRequest {
    signature: string;
    uuid: string;
    amount: string;
    recipient: string;
    tokenId: string; // Token being voted for
    target: string; // Target vault for transfer
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as QueueRequest;
        // Validation of required fields
        if (!body.signature || !body.uuid || !body.recipient || !body.amount) {
            return NextResponse.json({ success: false, error: 'Missing signature data' }, { status: 400 });
        }

        // Validate tokenId exists
        if (!body.tokenId) {
            return NextResponse.json({ success: false, error: 'Missing tokenId' }, { status: 400 });
        }

        // Validate token exists in our list
        const tokensResult = await listTokens();
        const tokens = tokensResult.success && tokensResult.tokens ? tokensResult.tokens : [];
        const tokenExists = tokens.some(token => token.contractId === body.tokenId);

        if (!tokenExists) {
            return NextResponse.json({
                success: false,
                error: `Token ID ${body.tokenId} not found in available tokens list`
            }, { status: 400 });
        }

        // Recover signer on-chain via SIP-018 recover read-call
        const args = [
            bufferFromHex(body.signature),
            principalCV('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1'),
            stringAsciiCV('TRANSFER_TOKENS'),
            noneCV(),
            optionalCVOf(uintCV(body.amount)),
            optionalCVOf(principalCV(body.target)),
            stringAsciiCV(body.uuid),
        ];

        // verify signature by calling the Blaze recover read-only function
        const signerPrincipal: any = await callReadOnlyFunction(
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
            'blaze-v1', 'recover', args
        );

        if (signerPrincipal.value !== body.recipient) {
            return NextResponse.json({ success: false, error: 'Invalid signature, must set self as recipient' }, { status: 400 });
        }

        // Record the vote (same logic as in place-bet API)
        const chaAmount = parseFloat(body.amount) / 1_000_000; // Convert from microunits to whole units
        const userId = body.recipient; // Use recipient address as userId

        // Increment token bet in KV
        const newAmountForToken = await incrementKVTokenBet(body.tokenId, chaAmount);
        if (newAmountForToken === null) {
            return NextResponse.json({ success: false, error: 'Failed to record bet' }, { status: 500 });
        }

        // Record the user's vote
        const vote = await recordUserVote(userId, body.tokenId, chaAmount);
        if (!vote) {
            console.warn('Queue API: Vote recorded in total count but failed to track for user');
        }

        // Enqueue intent
        const intent = {
            signerPrincipal,
            signature: body.signature,
            amount: body.amount,
            target: body.recipient,
            uuid: body.uuid,
            tokenId: body.tokenId, // Store the token ID for later routing
        };
        await kv.lpush(TX_QUEUE_KEY, JSON.stringify(intent));
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('QueueRoute Error:', error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
} 