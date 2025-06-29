import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getKVSpinStatus } from '@/lib/state';
import {
    buildXSwapTransaction,
    broadcastMultihopTransaction,
    SwapMetadata,
} from 'blaze-sdk'; // Using the blaze-sdk import path
import { fetchQuote } from 'dexterity-sdk';
import { fetchNonce, PostConditionMode } from '@stacks/transactions';

// Environment variables
const TX_QUEUE_KEY = 'meme-roulette-tx-queue';

const PRIVATE_KEY = process.env.PRIVATE_KEY!;

// Increase the maximum duration for this serverless function (in seconds)
// Adjust as needed, up to your Vercel plan's limit (e.g., 900 for Pro/Enterprise)
export const maxDuration = 300;

const BLAZE_SOLVER_ADDRESS = "SP3619DGWH08262BJAG0NPFHZQDPN4TKMXHC0ZQDN";

const getNonce = async () => {
    const nonce = await fetchNonce({ address: BLAZE_SOLVER_ADDRESS });
    return Number(nonce);
}

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to update leaderboard earnings with actual swap results
const updateLeaderboardEarnings = async (swapResults: Array<{
    userId: string;
    originalCHAAmount: number;
    actualTokensReceived: number;
    winningTokenId: string;
    chaDecimals: number;
    winningTokenDecimals: number;
}>) => {
    try {
        const { calculateEarningsUSD } = await import('@/lib/token-prices');
        const { updateUserStatsWithRealEarnings } = await import('@/lib/leaderboard-integration');

        for (const result of swapResults) {
            // Calculate real earnings using actual market prices and decimals
            const earnings = await calculateEarningsUSD(
                result.originalCHAAmount,
                result.actualTokensReceived,
                result.winningTokenId,
                result.chaDecimals,
                result.winningTokenDecimals
            );

            console.log(`User ${result.userId}: ${result.originalCHAAmount} CHA → ${result.actualTokensReceived} tokens`);
            console.log(`  Original: $${earnings.originalValueUSD.toFixed(4)} | Current: $${earnings.currentValueUSD.toFixed(4)}`);
            console.log(`  Profit: $${earnings.earningsUSD.toFixed(4)} (${earnings.earningsCHA.toFixed(2)} CHA equivalent)`);

            // Update leaderboard with real earnings
            await updateUserStatsWithRealEarnings(result.userId, earnings.earningsCHA);
        }
    } catch (error) {
        console.error('Failed to update leaderboard with real earnings:', error);
    }
};

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
    const swapResults: Array<{
        userId: string;
        originalCHAAmount: number;
        actualTokensReceived: number;
        winningTokenId: string;
        chaDecimals: number;
        winningTokenDecimals: number;
    }> = [];

    let raw: any;
    let nonce = await getNonce();

    while ((raw = await kv.rpop(TX_QUEUE_KEY))) {
        try {
            const intent = raw // Assuming raw is already the parsed object from KV

            console.log(`Processing intent for user ${intent.recipient}, originally bet on ${intent.destinationContract}, swapping ${intent.betAmount} of ${intent.sourceContract} to WINNER ${winningTokenId}, uuid ${intent.uuid}`);

            const quote = await fetchQuote(intent.sourceContract, winningTokenId, intent.betAmount);
            console.log('Quote:', quote);

            if (!quote) {
                throw new Error(`Failed to find route for swapping ${intent.sourceContract} to ${winningTokenId}`);
            }

            const swapMeta: SwapMetadata = {
                amountIn: intent.betAmount,
                signature: intent.signature,
                uuid: intent.uuid,
                recipient: intent.recipient,
            };

            const txConfig: any = await buildXSwapTransaction(quote, swapMeta);

            txConfig.nonce = nonce++;
            txConfig.postConditionMode = PostConditionMode.Allow;
            txConfig.postConditions = []

            console.log('Transaction Config from SDK:', txConfig);

            const broadcastResponse = await broadcastMultihopTransaction(txConfig, PRIVATE_KEY);
            console.log('Broadcast Response from SDK:', broadcastResponse);

            // Capture expected output amount from quote for earnings calculation
            const lastHop = quote.hops[quote.hops.length - 1];
            const expectedTokenOutput = Number(lastHop.quote?.amountOut || 0);
            // Get decimals from the first and last token in the path
            const chaDecimals = quote.path[0]?.decimals ?? 6;
            const winningTokenDecimals = quote.path[quote.path.length - 1]?.decimals ?? 6;

            results.push({
                uuid: intent.uuid,
                originalBetTokenId: intent.destinationContract,
                swappedToWinningTokenId: winningTokenId,
                success: true,
                txId: broadcastResponse.txid,
                expectedOutputTokens: expectedTokenOutput,
            });

            // Store swap result for leaderboard earnings calculation
            swapResults.push({
                userId: intent.recipient,
                originalCHAAmount: Number(intent.betAmount),
                actualTokensReceived: expectedTokenOutput, // Using quote estimate - in production, you'd verify from tx events
                winningTokenId: winningTokenId,
                chaDecimals,
                winningTokenDecimals,
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

    // Update leaderboard with real earnings after all swaps complete
    if (swapResults.length > 0) {
        console.log(`Updating leaderboard earnings for ${swapResults.length} users`);
        await updateLeaderboardEarnings(swapResults);
    }

    return NextResponse.json({
        success: true,
        winningToken: winningTokenId,
        results,
        earningsUpdated: swapResults.length > 0
    });
} 