import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { incrementKVTokenBet, recordUserVote } from '@/lib/state';
import { listTokens } from '@/app/actions';
import { recoverMultihopSigner } from 'blaze-sdk';

// Load environment constants
const TX_QUEUE_KEY = 'meme-roulette-tx-queue';

// Expected request shape based on updates in wallet-context.tsx
interface QueueRequest {
    signature: string;
    publicKey: string;
    uuid: string;
    recipient: string; // User's address, should match signer
    sourceContract: string; // e.g., CHARISMA_SUBNET_CONTRACT
    destinationContract: string; // Token contract ID being bet on
    betAmount: string; // Amount of sourceContract to use, in micro-units
    intentAction: string; // e.g., "TRANSFER_TOKENS" or "PLACE_BET_MULTI_HOP"
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as QueueRequest;
        // Validation of required fields
        if (!body.signature || !body.publicKey || !body.uuid || !body.recipient ||
            !body.sourceContract || !body.destinationContract || !body.betAmount || !body.intentAction) {
            return NextResponse.json({ success: false, error: 'Missing required signature or intent data' }, { status: 400 });
        }

        // Validate token exists in our list (using destinationContract as the token ID)
        const tokensResult = await listTokens();
        const tokens = tokensResult.success && tokensResult.tokens ? tokensResult.tokens : [];
        const tokenExists = tokens.some(token => token.contractId === body.destinationContract);

        if (!tokenExists) {
            return NextResponse.json({
                success: false,
                error: `Token ID ${body.destinationContract} not found in available tokens list`
            }, { status: 400 });
        }

        let recoveredSignerPrincipal: string;
        try {
            recoveredSignerPrincipal = await recoverMultihopSigner(
                body.signature,
                body.uuid,
                body.sourceContract,
                body.betAmount
            );
        } catch (sdkError: any) {
            console.error('SDK recoverSigner error:', sdkError);
            return NextResponse.json({ success: false, error: `Signature recovery failed: ${sdkError.message || String(sdkError)}` }, { status: 400 });
        }

        if (recoveredSignerPrincipal !== body.recipient) {
            console.warn(`Recovered signer mismatch. Recovered: ${recoveredSignerPrincipal}, Expected: ${body.recipient}`);
            return NextResponse.json({ success: false, error: 'Invalid signature or recipient mismatch' }, { status: 400 });
        }


        // Record the vote
        const userId = body.recipient; // Use recipient address as userId

        // Increment token bet in KV using destinationContract
        // Pass the raw micro-units amount (as an integer) to hincrby
        const betAmountMicroUnits = parseInt(body.betAmount, 10);
        if (isNaN(betAmountMicroUnits)) {
            return NextResponse.json({ success: false, error: 'Invalid bet amount format' }, { status: 400 });
        }
        const newAmountForToken = await incrementKVTokenBet(body.destinationContract, betAmountMicroUnits);
        if (newAmountForToken === null) {
            return NextResponse.json({ success: false, error: 'Failed to record bet' }, { status: 500 });
        }

        // Record the user's vote using destinationContract
        // recordUserVote now receives micro-units (integer). Ensure its logic is compatible.
        const vote = await recordUserVote(userId, body.destinationContract, betAmountMicroUnits);
        if (!vote) {
            console.warn('Queue API: Vote recorded in total count but failed to track for user');
        }

        // Enqueue intent with the new structure
        const intentToQueue = {
            signature: body.signature,
            publicKey: body.publicKey,
            uuid: body.uuid,
            recipient: body.recipient,
            sourceContract: body.sourceContract,
            destinationContract: body.destinationContract,
            betAmount: body.betAmount, // Store micro-units string
            intentAction: body.intentAction,
        };
        await kv.lpush(TX_QUEUE_KEY, JSON.stringify(intentToQueue));
        return NextResponse.json({ success: true, queuedUuid: body.uuid });
    } catch (error: any) {
        console.error('QueueRoute Error:', error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
} 