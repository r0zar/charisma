import { NextRequest, NextResponse } from "next/server"
import { validateStacksAddress } from "@stacks/transactions/dist/esm/utils"
import {
    bufferCV,
    stringAsciiCV,
    uintCV,
    principalCV,
    makeContractCall,
    broadcastTransaction,
    PostConditionMode,
    TxBroadcastResultOk
} from "@stacks/transactions"
import { STACKS_MAINNET } from "@stacks/network";
import { bufferFromHex } from "@stacks/transactions/dist/cl";

// Server-side private key for signing transactions (must be set via environment variable)
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("PRIVATE_KEY environment variable is not set!");
    // Optionally throw an error or handle appropriately
}

interface ExecuteRequest {
    messageType: "TRANSFER_TOKENS" | "TRANSFER_TOKENS_LTE" | "REDEEM_BEARER"
    contractId: string
    signature: string
    amount?: number
    bound?: number
    uuid: string
    recipient?: string
}

export async function POST(req: NextRequest) {
    // Check if the server key is configured
    if (!PRIVATE_KEY) {
        return NextResponse.json(
            { error: "Server private key not configured. Cannot execute transactions." },
            { status: 500 }
        );
    }

    try {
        const body = await req.json() as ExecuteRequest

        // --- Request Validation ---
        if (!body.messageType) {
            return NextResponse.json({ error: "Missing messageType" }, { status: 400 })
        }
        if (!body.contractId) {
            return NextResponse.json({ error: "Missing contractId" }, { status: 400 })
        }
        if (!body.signature) {
            return NextResponse.json({ error: "Missing signature" }, { status: 400 })
        }
        if (!body.uuid) {
            return NextResponse.json({ error: "Missing uuid" }, { status: 400 })
        }

        // Parse contract ID
        const [contractAddress, contractName] = body.contractId.split(".")
        if (!contractAddress || !contractName) {
            return NextResponse.json({ error: "Invalid contractId format" }, { status: 400 })
        }

        if (!validateStacksAddress(contractAddress)) {
            return NextResponse.json({ error: "Invalid contract address" }, { status: 400 })
        }

        // Validate type-specific parameters
        if ((body.messageType === "TRANSFER_TOKENS" || body.messageType === "TRANSFER_TOKENS_LTE") && !body.recipient) {
            return NextResponse.json({ error: "Missing recipient for transfer operation" }, { status: 400 })
        }

        if ((body.messageType === "TRANSFER_TOKENS" || body.messageType === "REDEEM_BEARER") && !body.amount) {
            return NextResponse.json({ error: "Missing amount for transfer/redeem operation" }, { status: 400 })
        }

        if (body.messageType === "TRANSFER_TOKENS_LTE" && !body.bound) {
            return NextResponse.json({ error: "Missing bound for bounded transfer operation" }, { status: 400 })
        }
        // --- End Request Validation ---

        // Determine function name based on message type
        const functionName = body.messageType === "TRANSFER_TOKENS"
            ? "x-transfer"
            : body.messageType === "TRANSFER_TOKENS_LTE"
                ? "x-transfer-lte"
                : "x-redeem"

        // Prepare function arguments for the contract call
        const functionArgs = [];

        // Add signature buffer
        functionArgs.push(bufferFromHex(body.signature));

        // Add function-specific arguments with proper Clarity Value types
        switch (body.messageType) {
            case "TRANSFER_TOKENS":
                functionArgs.push(uintCV(body.amount!));
                functionArgs.push(stringAsciiCV(body.uuid));
                functionArgs.push(principalCV(body.recipient!));
                break;
            case "TRANSFER_TOKENS_LTE":
                functionArgs.push(uintCV(body.bound!));
                // Note: Passing the actual amount to transfer. Assuming 'bound' is the intended actual amount here.
                functionArgs.push(uintCV(body.bound!));
                functionArgs.push(stringAsciiCV(body.uuid));
                functionArgs.push(principalCV(body.recipient!));
                break;
            case "REDEEM_BEARER":
                functionArgs.push(uintCV(body.amount!));
                functionArgs.push(stringAsciiCV(body.uuid));
                functionArgs.push(principalCV(body.recipient || contractAddress));
                break;
        }

        console.log({
            contractAddress,
            contractName,
            functionName,
            functionArgs,
        })

        // Create transaction options
        const txOptions = {
            contractAddress,
            contractName,
            functionName,
            functionArgs,
            senderKey: PRIVATE_KEY,
            network: STACKS_MAINNET,
            fee: 1000, // Adjust fee as needed
            postConditionMode: PostConditionMode.Deny, // Use .Deny or specific conditions in production
        };

        // Create and sign the transaction
        const transaction = await makeContractCall(txOptions);

        // Broadcast the transaction
        const broadcastResponse = await broadcastTransaction({ transaction }); // Use network object here

        return NextResponse.json(broadcastResponse)
    } catch (error) {
        console.error("Error executing transaction:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}

// example of how to call the contract with a different function
// const params = {
//     contract: `${contractAddress}.${contractName}` as `${string}.${string}`, // Explicitly cast to template literal type
//     functionName: "execute",
//     functionArgs: [
//         bufferCV(Buffer.from(cleanSignature, 'hex')),
//         stringAsciiCV(intent),
//         opcodeArg,
//         amountArg,
//         targetArg,
//         stringAsciiCV(uuid),
//     ],
//     network: network as any,
// };