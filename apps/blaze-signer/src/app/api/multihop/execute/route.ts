import { NextResponse } from 'next/server';
import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    uintCV,
    principalCV,
    contractPrincipalCV,
    stringAsciiCV,
    tupleCV,
    noneCV,
    ClarityValue,
    fetchCallReadOnlyFunction,
    optionalCVOf,
    cvToValue, // Import type
} from '@stacks/transactions';
import { STACKS_MAINNET, StacksNetwork } from '@stacks/network'; // Or use config
import { z } from 'zod'; // For input validation
import { bufferFromHex } from '@stacks/transactions/dist/cl';
import { ApiPayloadSchema, prepareMultihopTxArgs } from '@/lib/execute-service';

// TODO: Move to shared constants or config
const MULTIHOP_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc5";
const TOKEN_A_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-rc6";


// --- API Route Handler ---
export async function POST(request: Request) {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error("API Error: PRIVATE_KEY environment variable not set.");
        return NextResponse.json({ error: 'Server configuration error: Missing private key' }, { status: 500 });
    }

    const network: StacksNetwork = STACKS_MAINNET; // Use configured network

    try {
        const body = await request.json();

        // Validate input shape
        const validationResult = ApiPayloadSchema.safeParse(body);
        if (!validationResult.success) {
            console.error("API Validation Error:", validationResult.error.flatten());
            return NextResponse.json({ error: 'Invalid request payload', details: validationResult.error.flatten() }, { status: 400 });
        }
        const validatedData = validationResult.data;

        // Further validation/checks
        if (validatedData.hops.length !== validatedData.numHops) {
            return NextResponse.json({ error: `Payload validation failed: numHops (${validatedData.numHops}) does not match hops array length (${validatedData.hops.length})` }, { status: 400 });
        }
        if (validatedData.numHops > 0 && (!validatedData.hops[0].signature || !validatedData.hops[0].uuid)) {
            return NextResponse.json({ error: 'Payload validation failed: Signature and UUID are required for Hop 1' }, { status: 400 });
        }

        const [multihopAddr, multihopName] = MULTIHOP_CONTRACT_ID.split('.');

        // --- Recover Signer ---
        const response = await fetchCallReadOnlyFunction({
            contractAddress: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
            contractName: 'blaze-rc10',
            functionName: 'recover',
            functionArgs: [
                bufferFromHex(validatedData.hops[0]?.signature!),
                principalCV(TOKEN_A_CONTRACT_ID),
                stringAsciiCV('TRANSFER_TOKENS'),
                noneCV(),
                optionalCVOf(uintCV(BigInt(validatedData.amount))), // Use validated amount
                optionalCVOf(principalCV('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.monkey-d-luffy-rc11')), // Example target, adjust if needed
                stringAsciiCV(validatedData.hops[0]?.uuid!),
            ],
            network: 'mainnet', // Use configured network
            senderAddress: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS' // Or any valid sender for read-only call
        }).then(cvToValue);

        const signer = response.value

        console.log("API: Signer:", signer);

        // --- Prepare Transaction Args using Utility Function ---
        const { functionName, functionArgs } = prepareMultihopTxArgs(validatedData);

        // --- Create and Broadcast Transaction ---
        console.log(`API: Preparing ${functionName} call to ${multihopAddr}.${multihopName}`);
        const txOptions = {
            contractAddress: multihopAddr,
            contractName: multihopName,
            functionName,
            functionArgs,
            senderKey: privateKey,
            network,
            anchorMode: AnchorMode.Any, // Or Microblock if preferred
            postConditionMode: PostConditionMode.Deny, // Recommended for safety
            fee: 1000, // Optional: Estimate or set a fee
        };

        const transaction = await makeContractCall(txOptions);

        console.log("API: Broadcasting transaction...");
        const broadcastResponse = await broadcastTransaction({ transaction, network });
        console.log("API: Broadcast Response:", broadcastResponse);

        // Return the broadcast result (includes txid or error details)
        return NextResponse.json(broadcastResponse);

    } catch (error: unknown) {
        console.error("API Error during multi-hop execution:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        // Check for specific broadcast errors if needed
        if (typeof error === 'object' && error !== null && 'message' in error) {
            // Potentially parse broadcast errors further
        }
        return NextResponse.json({ error: `Failed to execute multi-hop swap: ${errorMessage}` }, { status: 500 });
    }
} 