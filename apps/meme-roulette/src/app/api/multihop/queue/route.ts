import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { listTokens } from 'dexterity-sdk';
import { recoverMultihopSigner } from 'blaze-sdk';
import { recordVoteWithLeaderboard } from '@/lib/leaderboard-integration';

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
        const tokens = await listTokens();
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

        // Record the user's vote using destinationContract
        // recordVoteWithLeaderboard receives micro-units (integer) and returns { vote, achievements }
        // This function will also handle incrementing the token bet internally
        const voteResult = await recordVoteWithLeaderboard(userId, body.destinationContract, betAmountMicroUnits);
        if (!voteResult.vote) {
            console.warn('Queue API: Vote recorded in total count but failed to track for user');
            return NextResponse.json({ success: false, error: 'Failed to record vote' }, { status: 500 });
        } else if (voteResult.achievements.length > 0) {
            console.log(`Queue API: User ${userId} earned ${voteResult.achievements.length} new achievements`);
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