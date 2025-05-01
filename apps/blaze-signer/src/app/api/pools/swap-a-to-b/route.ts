import { NextRequest, NextResponse } from 'next/server';
import {
    makeContractCall,
    broadcastTransaction,
    uintCV,
    stringAsciiCV,
    type TxBroadcastResult,
    PostConditionMode,
    principalCV,
    fetchCallReadOnlyFunction,
    noneCV,
    optionalCVOf,
    cvToValue,
} from '@stacks/transactions';
import { STACKS_MAINNET, type StacksNetwork } from '@stacks/network';
import { bufferFromHex } from '@stacks/transactions/dist/cl';

const TOKEN_A_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-rc6";

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
        const { poolContractId, signature, amount, uuid, recipient } = body;

        // --- Basic Validation ---
        if (!poolContractId || !signature || typeof amount === 'undefined' || !uuid) {
            return NextResponse.json({ success: false, message: 'Missing required fields.' }, { status: 400, headers });
        }
        if (!poolContractId.includes('.')) {
            return NextResponse.json({ success: false, message: 'Invalid pool contract ID format.' }, { status: 400, headers });
        }
        // --- End Validation ---

        // --- Recover Signer ---
        const response = await fetchCallReadOnlyFunction({
            contractAddress: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
            contractName: 'blaze-rc10',
            functionName: 'recover',
            functionArgs: [
                bufferFromHex(signature),
                principalCV(TOKEN_A_CONTRACT_ID),
                stringAsciiCV('TRANSFER_TOKENS'),
                noneCV(),
                optionalCVOf(uintCV(amount)),
                optionalCVOf(principalCV(poolContractId)),
                stringAsciiCV(uuid),
            ],
            network: 'mainnet',
            senderAddress: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'
        }).then(cvToValue);

        const signer = response.value

        console.log("API: Signer:", signer);

        const [contractAddress, contractName] = poolContractId.split('.');
        let amountBigInt: bigint;
        try {
            // Ensure amount is handled as bigint
            amountBigInt = BigInt(amount);
        } catch (e) {
            return NextResponse.json({ success: false, message: 'Invalid amount format.' }, { status: 400, headers });
        }

        const txOptions = {
            contractAddress,
            contractName,
            functionName: 'x-swap-a-to-b', // Function for swapping A to B 
            functionArgs: [
                uintCV(amountBigInt),     // Token amount to swap
                bufferFromHex(signature), // Signature from the user
                stringAsciiCV(uuid),      // UUID for the transaction
                principalCV(recipient),
            ],
            senderKey: PRIVATE_KEY,
            network: STACKS_MAINNET,
            fee: 1000, // Adjust fee as needed
            postConditionMode: PostConditionMode.Deny, // Use .Deny or specific conditions in production
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