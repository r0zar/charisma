import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    uintCV,
    principalCV,
    contractPrincipalCV,
    stringAsciiCV,
    optionalCVOf,
    noneCV,
    tupleCV,
    PrincipalCV,
    ClarityValue,
} from '@stacks/transactions';
import { bufferFromHex } from '@stacks/transactions/dist/cl';
import { STACKS_MAINNET } from '@stacks/network';
import { getKVSpinStatus } from '@/lib/state';
import { swapClient } from '@/lib/swap-client';
import { z } from 'zod';
import { prepareProcessTxArgs } from '@/lib/blaze-helper';
import { QueuedTxIntent } from '@/lib/blaze-helper';

// Environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const TX_QUEUE_KEY = 'meme-roulette-tx-queue';
const MULTIHOP_CONTRACT_ID = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc5';
const [MULTIHOP_ADDR, MULTIHOP_NAME] = MULTIHOP_CONTRACT_ID.split('.');


// --- Zod Schema for Input Validation ---
const HopSchema = z.object({
    vault: z.string().includes('.').min(3), // Basic validation SP...ADDR.CONTRACT
    opcode: z.string().length(2).optional(), // Optional hex string (0x00 or 0x01)
    signature: z.string().length(130).optional(), // Optional hex string 0x + 65 bytes * 2 hex chars
    uuid: z.string().max(36).optional(),
});

export async function POST(_req: NextRequest) {
    if (!PRIVATE_KEY) {
        return NextResponse.json({ success: false, error: 'Server private key not configured' }, { status: 500 });
    }

    // Get the winning token ID - this determines which tokenId to use with all intents when executing
    const status = await getKVSpinStatus();
    const winningTokenId = status.winningTokenId;
    if (!winningTokenId || winningTokenId === 'none') {
        return NextResponse.json({
            success: false,
            error: 'No winning token determined yet or round in progress'
        }, { status: 400 });
    }

    console.log(`Processing intents for winning token: ${winningTokenId}`);

    const results: Array<any> = [];
    let raw;
    // Process all queued intents
    while ((raw = await kv.rpop(TX_QUEUE_KEY))) {
        try {
            // Check if raw is already an object or needs parsing
            const intent: QueuedTxIntent = typeof raw === 'object' ? raw as QueuedTxIntent : JSON.parse(raw as string);

            console.log(`Processing intent for ${intent.tokenId} with uuid ${intent.uuid}`);

            // Use swapClient to get quote
            const quote = await swapClient.getQuote(
                'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1',  // Source token (winning token)
                winningTokenId,     // Destination token
                intent.amount
            );

            console.log('Quote:', quote);

            if (!quote) {
                throw new Error(`Failed to get quote`);
            }

            // Prepare transaction arguments using the utility function
            const { functionName, functionArgs } = prepareProcessTxArgs(quote, intent);

            const txOptions = {
                contractAddress: MULTIHOP_ADDR,
                contractName: MULTIHOP_NAME,
                functionName,
                functionArgs,
                senderKey: PRIVATE_KEY,
                network: STACKS_MAINNET,
                anchorMode: AnchorMode.Any, // Or Microblock if preferred
                postConditionMode: PostConditionMode.Deny, // Recommended for safety
                fee: 1000, // Optional: Estimate or set a fee
            };

            const tx = await makeContractCall(txOptions);
            const broadcastResponse = await broadcastTransaction({
                transaction: tx,
                network: STACKS_MAINNET
            });

            console.log({ broadcastResponse });

            results.push({
                uuid: intent.uuid,
                tokenId: intent.tokenId,
                success: true,
                broadcastResponse
            });

        } catch (err: any) {
            console.error('Error processing intent:', err);
            results.push({ success: false, error: err.message || String(err) });
        }
    }

    return NextResponse.json({
        success: true,
        winningToken: winningTokenId,
        results
    });
} 