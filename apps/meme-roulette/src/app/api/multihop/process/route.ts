import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getKVSpinStatus } from '@/lib/state';
import {
    buildXSwapTransaction,
    broadcastMultihopTransaction,
    SwapMetadata,
    TransactionConfig,
    MULTIHOP_CONTRACT_ID,
} from 'blaze-sdk'; // Using the blaze-sdk import path
import { fetchQuote } from 'dexterity-sdk';

// Environment variables
const TX_QUEUE_KEY = 'meme-roulette-tx-queue';


const PRIVATE_KEY = process.env.PRIVATE_KEY!;

// Increase the maximum duration for this serverless function (in seconds)
// Adjust as needed, up to your Vercel plan's limit (e.g., 900 for Pro/Enterprise)
export const maxDuration = 300;

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(_req: NextRequest) {
    if (!PRIVATE_KEY) {
        console.error('Server private key not configured');
        return NextResponse.json({ success: false, error: 'Server private key not configured' }, { status: 500 });
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
            const intent = raw // Assuming raw is already the parsed object from KV

            console.log(`Processing intent for user ${intent.recipient}, originally bet on ${intent.destinationContract}, swapping ${intent.betAmount} of ${intent.sourceContract} to WINNER ${winningTokenId}, uuid ${intent.uuid}`);

            const quote = await fetchQuote(intent.sourceContract, winningTokenId, intent.betAmount);
            console.log('Quote:', quote);

            if (!quote.route) {
                throw new Error(`Failed to find route for swapping ${intent.sourceContract} to ${winningTokenId}`);
            }

            const swapMeta: SwapMetadata = {
                amountIn: intent.betAmount,
                signature: intent.signature,
                uuid: intent.uuid,
                recipient: intent.recipient,
            };

            const txConfig: TransactionConfig = await buildXSwapTransaction(quote.route, swapMeta);
            console.log('Transaction Config from SDK:', txConfig);

            const broadcastResponse = await broadcastMultihopTransaction(txConfig, PRIVATE_KEY);
            console.log('Broadcast Response from SDK:', broadcastResponse);

            results.push({
                uuid: intent.uuid,
                originalBetTokenId: intent.destinationContract,
                swappedToWinningTokenId: winningTokenId,
                success: true,
                txId: broadcastResponse.txid,
            });

        } catch (err: any) {
            console.error('Error processing intent:', err);
            const intentDetails = typeof raw === 'string' ? JSON.parse(raw) : raw; // Should not be needed if KV stores objects
            results.push({
                uuid: intentDetails?.uuid || 'unknown_uuid',
                originalBetTokenId: intentDetails?.destinationContract || 'unknown_token',
                success: false,
                error: err.message || String(err)
            });
        } finally {
            // Add a 3-second delay after processing each intent (or attempting to)
            console.log('Delaying for 3 seconds before next iteration...');
            await delay(3000);
        }
    }

    return NextResponse.json({
        success: true,
        winningToken: winningTokenId,
        results
    });
} 