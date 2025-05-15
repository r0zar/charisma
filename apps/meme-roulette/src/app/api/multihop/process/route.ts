import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

import { getKVSpinStatus } from '@/lib/state';

import {
    buildXSwapTransaction,
    broadcastMultihopTransaction,
    SwapMetadata,
    Route as BlazeSdkRoute, // Alias to avoid conflict if local Route type exists
    TransactionConfig,
} from 'blaze-sdk'; // Using the blaze-sdk import path
import { Dexterity } from '@/lib/dexterity-client';
import { createSwapClient } from '@/lib/swap-client';

// Environment variables
const TX_QUEUE_KEY = 'meme-roulette-tx-queue';


const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const swapClient = createSwapClient();

export async function POST(_req: NextRequest) {
    if (!PRIVATE_KEY) {
        console.error('Server private key not configured');
        return NextResponse.json({ success: false, error: 'Server private key not configured' }, { status: 500 });
    }

    if (Dexterity.config.routerName !== 'x-multihop-rc9') {
        console.error('Router not configured');
        return NextResponse.json({ success: false, error: 'Router not configured' }, { status: 500 });
    }

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
    let raw: any;
    while ((raw = await kv.rpop(TX_QUEUE_KEY))) {
        try {
            const intent = raw

            // Assuming intent.destinationContract holds the token user originally bet on.
            // The swap destination is the winningTokenId for payouts.
            console.log(`Processing intent for user ${intent.recipient}, originally bet on ${intent.destinationContract}, swapping ${intent.betAmount} of ${intent.sourceContract} to WINNER ${winningTokenId}, uuid ${intent.uuid}`);

            const quote: any = await swapClient.getQuote(
                intent.sourceContract, // Should be CHARISMA_SUBNET_CONTRACT based on intent creation
                winningTokenId,        // Destination is the winning token
                intent.betAmount       // Amount of source token to swap
            );

            console.log('Quote received:', quote);

            if (!quote || !quote.route) {
                throw new Error(`Failed to get quote for swapping ${intent.sourceContract} to ${winningTokenId}`);
            }

            // Map QueuedTxIntent to SwapMetadata
            const swapMeta: SwapMetadata = {
                amountIn: intent.betAmount, // This is in micro-units as a string
                signature: intent.signature,
                uuid: intent.uuid,
                recipient: intent.recipient, // The user who made the bet is the recipient of the swap
            };

            // Build the transaction using the Blaze SDK
            // buildXSwapTransaction uses DEFAULT_ROUTER_CONFIG from SDK constants
            const txConfig: TransactionConfig = await buildXSwapTransaction(quote.route, swapMeta);

            console.log('Transaction Config from SDK:', txConfig);

            // Broadcast the transaction using the Blaze SDK
            const broadcastResponse = await broadcastMultihopTransaction(txConfig, PRIVATE_KEY);

            console.log('Broadcast Response from SDK:', broadcastResponse);

            results.push({
                uuid: intent.uuid,
                originalBetTokenId: intent.destinationContract, // Keep track of what they bet on
                swappedToWinningTokenId: winningTokenId,
                success: true,
                txId: broadcastResponse.txid, // Assuming broadcastResponse has a txid
            });

        } catch (err: any) {
            console.error('Error processing intent:', err);
            const intentDetails = typeof raw === 'string' ? JSON.parse(raw) : raw;
            results.push({
                uuid: intentDetails?.uuid || 'unknown_uuid',
                originalBetTokenId: intentDetails?.destinationContract || 'unknown_token',
                success: false,
                error: err.message || String(err)
            });
        }
    }

    return NextResponse.json({
        success: true,
        winningToken: winningTokenId,
        results
    });
} 