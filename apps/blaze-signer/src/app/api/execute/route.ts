import { NextRequest, NextResponse } from "next/server"
import { kv } from "@vercel/kv"; // Import Vercel KV
import { validateStacksAddress } from "@stacks/transactions/dist/esm/utils"
// Import Clarity value constructors and helpers
import {
    cvToValue,
    principalCV,
    cvToHex,
    hexToCV,
    stringAsciiCV,
    uintCV,
    optionalCVOf,
    noneCV,
    ClarityType,
} from "@stacks/transactions"
// Import API client
// Removed: import { createClient } from "@stacks/blockchain-api-client"
import { apiClient } from "@/lib/stacks-api-client"; // Import shared client
// Import shared types
import type { ExecuteRequest, QueuedTxIntent } from "@/lib/types"
import { bufferFromHex } from "@stacks/transactions/dist/cl";

// Server-side private key for signing transactions (must be set via environment variable)
// Keep the key check, as the cron job will need it.
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("PRIVATE_KEY environment variable is not set!");
    // Optionally throw an error or handle appropriately
}

// Define the queue key
const TX_QUEUE_KEY = "stacks-tx-queue";
const TRACKED_PRINCIPALS_KEY = "tracked-principals"; // Key for the principal address set
const TRACKED_TOKENS_KEY = "tracked-tokens";       // Key for the token contract ID set

// --- Stacks API Client Setup (Replicated for recovery) ---
// Removed client setup block
// --- End Client Setup ---

// Signer contract identifier for recovery
const BLAZE_SIGNER_CONTRACT_ID = process.env.BLAZE_SIGNER_CONTRACT_ID || "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-v1";
const [BLAZE_SIGNER_ADDRESS, BLAZE_SIGNER_NAME] = BLAZE_SIGNER_CONTRACT_ID.split(".");

export async function POST(req: NextRequest) {
    // Keep the private key check for early exit if not configured
    if (!PRIVATE_KEY) {
        return NextResponse.json(
            { error: "Server private key not configured. Cannot queue transactions." },
            { status: 500 }
        );
    }

    try {
        const body = await req.json() as ExecuteRequest

        // --- Keep all existing Request Validation ---
        if (!body.messageType || !body.contractId || !body.signature || !body.uuid) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        // Ensure contractId has the expected format before splitting
        if (!body.contractId.includes('.')) {
            return NextResponse.json({ error: `Invalid contractId format: ${body.contractId}. Expected 'address.name'.` }, { status: 400 });
        }

        // Validate type-specific parameters
        if ((body.messageType === "TRANSFER_TOKENS" || body.messageType === "TRANSFER_TOKENS_LTE") && !body.recipient) {
            return NextResponse.json({ error: "Missing recipient for transfer operation" }, { status: 400 })
        }
        let recipientAddress: string | null = null;
        if (body.recipient) {
            if (!validateStacksAddress(body.recipient)) {
                return NextResponse.json({ error: `Invalid recipient address: ${body.recipient}` }, { status: 400 });
            }
            recipientAddress = body.recipient;
        }

        const amountOrBound = body.messageType === 'TRANSFER_TOKENS_LTE' ? body.bound : body.amount;
        if ((body.messageType === "TRANSFER_TOKENS" || body.messageType === "REDEEM_BEARER") && (body.amount === undefined || body.amount <= 0)) {
            return NextResponse.json({ error: "Missing or invalid amount for transfer/redeem operation" }, { status: 400 })
        }

        if (body.messageType === "TRANSFER_TOKENS_LTE" && (body.bound === undefined || body.bound <= 0)) {
            return NextResponse.json({ error: "Missing or invalid bound for bounded transfer operation" }, { status: 400 })
        }
        // --- End Request Validation ---

        // --- Recover Signer ---
        let recoveredSignerAddress: string | null = null;
        try {
            const recoverArgs = [
                bufferFromHex(body.signature),
                principalCV(body.contractId),
                stringAsciiCV(body.messageType), // intent
                noneCV(), // opcodeOptional - Always none() for TRANSFER_TOKENS/TRANSFER_TOKENS_LTE based on current logic
                amountOrBound !== null && amountOrBound !== undefined ? optionalCVOf(uintCV(amountOrBound)) : noneCV(), // amountOptional or boundOptional
                recipientAddress ? optionalCVOf(principalCV(recipientAddress)) : noneCV(), // targetOptional
                stringAsciiCV(body.uuid)
            ];

            console.log("Execute API: Calling recover with args:", recoverArgs.map(cvToHex));

            const response = await apiClient.POST(
                `/v2/contracts/call-read/${BLAZE_SIGNER_ADDRESS}/${BLAZE_SIGNER_NAME}/recover` as any,
                {
                    body: {
                        sender: BLAZE_SIGNER_ADDRESS, // Can be any valid address
                        arguments: recoverArgs.map(cvToHex),
                    },
                }
            );

            if (response?.data?.okay && response?.data?.result) {
                const resultCV = hexToCV(response.data.result);
                if (resultCV.type === ClarityType.ResponseOk && resultCV.value.type === ClarityType.PrincipalStandard) {
                    recoveredSignerAddress = cvToValue(resultCV.value);
                    console.log(`Execute API: Recovered signer: ${recoveredSignerAddress}`);
                } else {
                    console.warn(`Execute API: Recover function did not return (ok principal):`, cvToValue(resultCV));
                }
            } else {
                const cause = response?.data?.cause || 'Unknown API error';
                console.warn(`Execute API: API Error recovering signer:`, cause);
            }
        } catch (recoverError) {
            console.error("Execute API: Error calling recover function:", recoverError);
            // Don't fail the request, just log and proceed without the recovered signer
        }
        // --- End Recover Signer ---

        // --- Track Principals & Tokens in KV Sets --- 
        try {
            let addedPrincipalsCount = 0;
            let addedTokensCount = 0;
            const principalsToTrack = new Set<string>();

            // Extract address part for principal tracking
            const contractAddress = body.contractId.split('.')[0];

            // Add token contract address (principal part)
            if (validateStacksAddress(contractAddress)) {
                principalsToTrack.add(contractAddress);
            }
            // Add recipient address if it exists and is valid
            if (recipientAddress) { // recipientAddress is already validated
                principalsToTrack.add(recipientAddress);
            }
            // Add recovered signer address if valid
            if (recoveredSignerAddress && validateStacksAddress(recoveredSignerAddress)) {
                principalsToTrack.add(recoveredSignerAddress);
            }

            // Add all unique, valid principals to the principals KV set
            for (const principal of principalsToTrack) {
                addedPrincipalsCount += await kv.sadd(TRACKED_PRINCIPALS_KEY, principal);
            }

            // Add the full token contract ID to the tokens KV set
            addedTokensCount += await kv.sadd(TRACKED_TOKENS_KEY, body.contractId);

            console.log(`Execute API: Added/updated ${addedPrincipalsCount} principals in ${TRACKED_PRINCIPALS_KEY} (${[...principalsToTrack].join(", ")}).`);
            console.log(`Execute API: Added/updated ${addedTokensCount} token in ${TRACKED_TOKENS_KEY} (${body.contractId}).`);

        } catch (kvError) {
            console.error("Execute API: Failed to add principals/tokens to tracked sets:", kvError);
            // Don't fail the request, just log and proceed
        }
        // --- End Track Principals & Tokens ---

        // --- Map ExecuteRequest to Simplified QueuedTxIntent ---
        const intentData: QueuedTxIntent = {
            signature: body.signature,
            contractId: body.contractId, // Store the full contract ID
            intent: body.messageType,    // Use messageType as intent string
            opcodeOptional: null,        // Assuming no opcode for these message types
            amountOptional: amountOrBound, // Use the combined var here too
            targetOptional: recipientAddress, // Use validated recipient address
            uuid: body.uuid,
        };

        // Ensure optional fields are null if undefined (redundant if handled above, but safe)
        if (intentData.amountOptional === undefined) intentData.amountOptional = null;
        if (intentData.targetOptional === undefined) intentData.targetOptional = null;

        // --- Push QueuedTxIntent onto the KV queue ---
        try {
            await kv.lpush(TX_QUEUE_KEY, JSON.stringify(intentData));
            console.log(`Execute API: Queued transaction intent: ${intentData.uuid} (${intentData.intent})`);
        } catch (kvError) {
            console.error("Execute API: Failed to push transaction to KV queue:", kvError);
            return NextResponse.json(
                { error: "Failed to queue transaction for processing." },
                { status: 500 }
            );
        }

        // Return a success response indicating the message is queued
        return NextResponse.json({
            message: "Transaction intent queued successfully.",
            uuid: intentData.uuid
        });

    } catch (error) {
        console.error("Execute API: Error processing execution request:", error)
        // Handle JSON parsing errors or other unexpected issues before validation
        if (error instanceof SyntaxError) {
            return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
        }
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown server error" },
            { status: 500 }
        )
    }
}

// Remove example comment
// // example of how to call the contract with a different function
// // const params = ...