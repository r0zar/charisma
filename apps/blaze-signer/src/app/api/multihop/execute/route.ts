import { NextResponse } from 'next/server';
import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    uintCV,
    principalCV,
    stringAsciiCV,
    noneCV,
    cvToValue,
    optionalCVOf,
} from '@stacks/transactions';
import { callReadOnlyFunction } from '@repo/polyglot';
import { STACKS_MAINNET, StacksNetwork } from '@stacks/network'; // Or use config
import { bufferFromHex } from '@stacks/transactions/dist/cl';
import { ApiPayloadSchema } from '@/lib/execute-service';

// TODO: Move to shared constants or config
const MULTIHOP_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9";


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

        // --- Deserialize function args & postconditions from hex ---
        const { deserializeCV } = await import('@stacks/transactions/dist/clarity/deserialize');
        const { deserializePostConditionWire } = await import('@stacks/transactions/dist/wire/serialization');
        const { wireToPostCondition } = await import('@stacks/transactions/dist/postcondition');

        const functionArgs = validatedData.tx.functionArgs.map((hex) => deserializeCV(hex));
        const postConditions = validatedData.tx.postConditions.map((hex) =>
            wireToPostCondition(deserializePostConditionWire(hex))
        );

        // Extract token and amount from first tuple arg for recover check
        const inTuple: any = functionArgs[0];
        const inputTokenCV = inTuple.value.token;
        const amountCV = inTuple.value.amount;
        const inputTokenStr = cvToValue(inputTokenCV) as string;
        const amountU = (amountCV.value as bigint).toString();

        const response = await callReadOnlyFunction(
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
            'blaze-v1',
            'recover',
            [
                bufferFromHex(validatedData.signature),
                principalCV(inputTokenStr),
                stringAsciiCV('TRANSFER_TOKENS'),
                noneCV(),
                optionalCVOf(uintCV(BigInt(amountU))),
                optionalCVOf(principalCV(MULTIHOP_CONTRACT_ID)),
                stringAsciiCV(validatedData.uuid),
            ],
        );

        const signerCV = response?.value;
        if (!signerCV) {
            throw new Error('No signer returned from contract call');
        }
        const signer = cvToValue(signerCV) as string;

        // --- Verbose Debug Logging ---
        console.log("\n=========== MULTIHOP EXECUTION DEBUG ===========");
        console.log("Recovered signer (public key hash):", signer);
        console.log("Amount (u):", amountU);
        console.log("Input token:", inputTokenStr);
        console.log("Function:", validatedData.tx.functionName);
        console.log("Args count:", functionArgs.length);
        console.log("===============================================\n");

        // --- Create and Broadcast Transaction ---
        console.log(`API: Preparing ${validatedData.tx.functionName} call to ${validatedData.tx.contractAddress}.${validatedData.tx.contractName}`);
        console.log("API: Function Args:", functionArgs[1]);
        const txOptions = {
            contractAddress: validatedData.tx.contractAddress,
            contractName: validatedData.tx.contractName,
            functionName: validatedData.tx.functionName,
            functionArgs,
            senderKey: privateKey,
            network,
            anchorMode: AnchorMode.Any, // Or Microblock if preferred
            postConditionMode: PostConditionMode.Allow,
            postConditions,
            fee: 1500, // Optional: Estimate or set a fee
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