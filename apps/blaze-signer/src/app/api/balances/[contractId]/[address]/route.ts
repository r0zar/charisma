import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { validateStacksAddress } from '@stacks/transactions/dist/esm/utils';
import { cvToValue, principalCV, ClarityValue, deserializeCV, cvToHex, hexToCV } from '@stacks/transactions';
import { apiClient } from '@/lib/stacks-api-client'; // Import shared client
import { calculatePendingBalanceDiff } from '@/lib/balance-diff';
import type { QueuedTxIntent } from '@/lib/types'; // Added type import

// --- CORS Headers --- 
// Allow requests from frontend dev server or any origin in dev, restrict in prod if needed
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// --- Preflight OPTIONS Handler ---
export async function OPTIONS(request: Request) {
    return new NextResponse(null, {
        status: 204, // No Content
        headers: corsHeaders,
    });
}

// Queue key
const TX_QUEUE_KEY = 'stacks-tx-queue';

// --- Stacks API Client Setup (using createClient) ---
// Removed client setup block
// --- End Stacks API Client Setup ---

export async function GET(
    request: Request,
    { params }: { params: { contractId: string; address: string } }
) {
    const { contractId, address } = await params;

    // --- Validation ---
    if (!contractId) {
        return NextResponse.json({ error: 'Missing contractId' }, { status: 400, headers: corsHeaders });
    }
    if (!address) {
        return NextResponse.json({ error: 'Missing address' }, { status: 400, headers: corsHeaders });
    }

    const [contractAddress, contractName] = contractId.split('.');
    if (!contractAddress || !contractName || !validateStacksAddress(contractAddress)) {
        return NextResponse.json({ error: 'Invalid contractId format or address' }, { status: 400, headers: corsHeaders });
    }
    if (!validateStacksAddress(address)) {
        return NextResponse.json({ error: 'Invalid address' }, { status: 400, headers: corsHeaders });
    }
    // --- End Validation ---

    try {
        // --- 1. Fetch On-Chain Balance (using createClient instance) ---
        let onChainBalance: bigint = 0n;
        try {
            // Use the POST method similar to the example
            const result = await apiClient.POST(
                `/v2/contracts/call-read/${contractAddress}/${contractName}/get-balance` as any, // Cast path for type compatibility
                {
                    body: {
                        sender: contractAddress, // Can be any valid address for read-only
                        arguments: [cvToHex(principalCV(address))], // Convert arg CV to hex string
                    },
                }
            )

            // Check response and extract value
            // The response structure might differ slightly, adjust based on actual output if needed
            if (result.response.ok && result.data.result) {
                onChainBalance = BigInt(cvToValue(hexToCV(result.data.result)).value);
            } else {
                // Extract error cause if available
                const cause = result.error?.cause || 'Unknown API error';
                console.error(`API Error fetching balance for ${contractId}, ${address}:`, cause);
                throw new Error(`API Error: ${cause}`);
            }
        } catch (error) {
            console.error(`Error calling read-only function for ${contractId}, ${address}:`, error);
            return NextResponse.json(
                { error: error instanceof Error ? error.message : 'Failed to fetch on-chain balance' },
                { status: 500, headers: corsHeaders }
            );
        }

        // --- 2. Fetch Pending Messages ---
        const pendingMessages = await kv.lrange<QueuedTxIntent>(TX_QUEUE_KEY, 0, -1);

        // --- 3. Calculate Balance Diff (using imported function) ---
        const balanceDiff = await calculatePendingBalanceDiff(contractId, address, pendingMessages);

        // --- 4. Combine Balances ---
        const preconfirmationBalance = onChainBalance + balanceDiff;

        // --- 5. Return Result ---
        return NextResponse.json({
            contractId,
            address,
            onChainBalance: onChainBalance.toString(),
            pendingDiff: balanceDiff.toString(),
            preconfirmationBalance: preconfirmationBalance.toString(),
        }, { headers: corsHeaders });
    } catch (error) {
        console.error('Error calculating preconfirmation balance:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown server error' },
            { status: 500, headers: corsHeaders }
        );
    }
} 