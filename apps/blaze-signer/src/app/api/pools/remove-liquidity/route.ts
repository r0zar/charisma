import { NextRequest, NextResponse } from 'next/server';
import {
    makeContractCall,
    broadcastTransaction,
    uintCV,
    stringAsciiCV,
    type TxBroadcastResult,
    PostConditionMode,
    Pc,
    fetchCallReadOnlyFunction,
    cvToValue,
    principalCV,
    optionalCVOf,
    noneCV,
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
        const { poolContractId, signature, lpAmount, uuid } = body;

        // --- Basic Validation ---
        if (!poolContractId || !signature || typeof lpAmount === 'undefined' || !uuid) {
            return NextResponse.json({ success: false, message: 'Missing required fields.' }, { status: 400, headers });
        }
        if (!poolContractId.includes('.')) {
            return NextResponse.json({ success: false, message: 'Invalid pool contract ID format.' }, { status: 400, headers });
        }
        // --- End Validation ---

        const [contractAddress, contractName] = poolContractId.split('.');
        let lpAmountBigInt: bigint;
        try {
            // Ensure lpAmount is handled as bigint
            lpAmountBigInt = BigInt(lpAmount);
        } catch (e) {
            return NextResponse.json({ success: false, message: 'Invalid lpAmount format.' }, { status: 400, headers });
        }

        const response = await fetchCallReadOnlyFunction({
            contractAddress: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
            contractName: 'blaze-v1',
            functionName: 'recover',
            functionArgs: [
                bufferFromHex(signature),
                principalCV(poolContractId),
                stringAsciiCV('REMOVE_LIQUIDITY'),
                noneCV(),
                optionalCVOf(uintCV(lpAmountBigInt)),
                noneCV(),
                stringAsciiCV(uuid),
            ],
            network: 'mainnet',
            senderAddress: contractAddress
        }).then(cvToValue);

        const signer = response.value

        const txOptions = {
            contractAddress,
            contractName,
            functionName: 'x-remove-liquidity', // Assuming this contract function exists
            functionArgs: [
                uintCV(lpAmountBigInt),     // LP token amount to burn
                bufferFromHex(signature),   // Signature from the user
                stringAsciiCV(uuid),        // UUID for the transaction
            ],
            senderKey: PRIVATE_KEY,
            network: STACKS_MAINNET,
            fee: 1000, // Adjust fee as needed
            postConditionMode: PostConditionMode.Deny, // Use .Deny or specific conditions in production
            postConditions: [Pc.principal(signer).willSendEq(lpAmount).ft(poolContractId, 'luffy')]
        };

        const transaction = await makeContractCall(txOptions);

        // Broadcast the transaction
        const broadcastResponse = await broadcastTransaction({ transaction });

        // Return the response to the frontend
        return NextResponse.json(broadcastResponse, { status: 200, headers });

    } catch (error: any) {
        console.error('API Route Error:', error);
        // Return a generic error structure
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500, headers });
    }
} 