import { NextRequest, NextResponse } from 'next/server';
import {
    makeContractCall,
    broadcastTransaction,
    uintCV,
    stringAsciiCV,
    PostConditionMode,
    principalCV,
} from '@stacks/transactions';
import { STACKS_MAINNET } from '@stacks/network';
import { bufferFromHex } from '@stacks/transactions/dist/cl';

// Server-side private key for signing transactions (must be set via environment variable)
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("PRIVATE_KEY environment variable is not set!");
    // Optionally throw an error or handle appropriately
}

// Basic CORS headers
const headers = {
    'Access-Control-Allow-Origin': '*', // Adjust in production
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, { status: 204, headers });
}

export async function POST(request: NextRequest) {
    // Check if the server key is configured
    if (!PRIVATE_KEY) {
        return NextResponse.json(
            { error: "Server private key not configured. Cannot execute transactions." },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const { poolContractId, signatureA, signatureB, lpAmount, uuidA, uuidB, recipientA, recipientB } = body;

        // --- Basic Validation ---
        if (!poolContractId || !signatureA || !signatureB || typeof lpAmount === 'undefined' || !uuidA || !uuidB) {
            return NextResponse.json({ success: false, message: 'Missing required fields.' }, { status: 400, headers });
        }
        if (!poolContractId.includes('.')) {
            return NextResponse.json({ success: false, message: 'Invalid pool contract ID format.' }, { status: 400, headers });
        }
        if (!recipientA || !recipientB) {
            return NextResponse.json({ success: false, message: 'Missing recipient addresses.' }, { status: 400, headers });
        }
        // Add more validation for signature format, UUID format, lpAmount type/range if needed
        // --- End Validation ---

        const [contractAddress, contractName] = poolContractId.split('.');
        let lpAmountBigInt: bigint;
        try {
            // Ensure lpAmount is handled as bigint
            lpAmountBigInt = BigInt(lpAmount);
        } catch (e) {
            return NextResponse.json({ success: false, message: 'Invalid lpAmount format.' }, { status: 400, headers });
        }

        const txOptions = {
            contractAddress,
            contractName,
            functionName: 'x-add-liquidity',
            functionArgs: [
                uintCV(lpAmountBigInt),
                bufferFromHex(signatureA), // Signature for token A
                stringAsciiCV(uuidA),      // UUID for token A
                bufferFromHex(signatureB), // Signature for token B
                stringAsciiCV(uuidB),      // UUID for token B
                principalCV(recipientA),
                principalCV(recipientB),
            ],
            senderKey: PRIVATE_KEY,
            network: STACKS_MAINNET,
            fee: 1000, // Adjust fee as needed
            postConditionMode: PostConditionMode.Deny, // Use .Deny or specific conditions in production
        };

        const transaction = await makeContractCall(txOptions);

        // Correct call based on /api/execute example
        const broadcastResponse = await broadcastTransaction({ transaction });

        // Directly return the broadcast response for the frontend to handle
        return NextResponse.json(broadcastResponse, { status: 200, headers });

    } catch (error: any) {
        console.error('API Route Error:', error);
        // Return a generic error structure consistent with the success case potentially
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500, headers });
    }
} 