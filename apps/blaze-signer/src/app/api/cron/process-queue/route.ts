import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import {
    validateStacksAddress
} from "@stacks/transactions/dist/esm/utils";
import {
    bufferCV,
    stringAsciiCV,
    uintCV,
    principalCV,
    makeContractCall,
    broadcastTransaction,
    PostConditionMode,
    TxBroadcastResult,
    noneCV
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";
import { bufferFromHex } from "@stacks/transactions/dist/cl";
import type { QueuedTxIntent } from "@/lib/types";

// Queue key (should match the one used in /api/execute)
const TX_QUEUE_KEY = "stacks-tx-queue";

// Server-side private key (must be set via environment variable)
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Maximum number of messages to process per cron run
const MAX_MESSAGES_PER_RUN = 10;

export async function GET(request: Request) {
    // Secure the endpoint (Optional but recommended: Add Vercel Cron job secret check)
    // const authToken = (request.headers.get('authorization') || '').split("Bearer ").at(1);
    // if (authToken !== process.env.CRON_SECRET) {
    //     return new Response('Unauthorized', { status: 401 });
    // }

    if (!PRIVATE_KEY) {
        console.error("CRON: PRIVATE_KEY environment variable is not set! Cannot process queue.");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    let processedCount = 0;
    let errorCount = 0;

    try {
        // Fetch up to MAX_MESSAGES_PER_RUN messages from the *end* of the list (FIFO)
        // LRANGE key 0 -1 fetches all. We want FIFO, so lpush/rpop or rpush/lpop.
        // Since /execute uses LPUSH, we use RPOP here.
        // Let's process one by one for simpler error handling initially.
        for (let i = 0; i < MAX_MESSAGES_PER_RUN; i++) {
            const messageJson = await kv.rpop(TX_QUEUE_KEY);

            if (!messageJson) {
                // Queue is empty or we've processed the batch limit
                break;
            }

            let message: QueuedTxIntent | null = null;
            try {
                // Check if the retrieved item is a string that needs parsing,
                // or if it's already an object (parsed by kv client).
                if (typeof messageJson === 'string') {
                    console.log("CRON: Parsing message string from KV...");
                    message = JSON.parse(messageJson) as QueuedTxIntent;
                } else if (messageJson && typeof messageJson === 'object') {
                    // Assume it's already the correct object structure
                    console.log("CRON: Using pre-parsed message object from KV...");
                    message = messageJson as QueuedTxIntent;
                } else {
                    // Handle unexpected type from kv.rpop
                    throw new Error(`Unexpected data type from kv.rpop: ${typeof messageJson}`);
                }

                // Basic validation (now applied to the potentially parsed/casted message)
                if (!message || typeof message !== 'object' || !message.contractId || !message.intent || !message.signature || !message.uuid) {
                    console.error("CRON: Invalid message structure after processing:", message);
                    throw new Error("Invalid QueuedTxIntent format in queue");
                }

                // --- Split contractId for transaction --- 
                if (!message.contractId.includes('.')) {
                    throw new Error(`Invalid contractId format in queued message: ${message.contractId}`);
                }

                // Determine function name based on intent (originalMessageType is no longer stored)
                const functionName = message.intent === "TRANSFER_TOKENS"
                    ? "x-transfer"
                    : message.intent === "TRANSFER_TOKENS_LTE"
                        ? "x-transfer-lte"
                        : message.intent === "REDEEM_BEARER"
                            ? "x-redeem"
                            : null; // Handle potential unknown intent

                if (!functionName) {
                    throw new Error(`Unknown intent found in queued message: ${message.intent}`);
                }

                // Prepare function arguments
                const functionArgs = [];
                functionArgs.push(bufferFromHex(message.signature));

                switch (message.intent) {
                    case "TRANSFER_TOKENS":
                        // Amount and recipient are in amountOptional/targetOptional
                        if (message.amountOptional === null || message.amountOptional === undefined || message.targetOptional === null || message.targetOptional === undefined || !validateStacksAddress(message.targetOptional)) {
                            throw new Error(`Invalid args for TRANSFER_TOKENS intent: ${JSON.stringify(message)}`);
                        }
                        functionArgs.push(uintCV(message.amountOptional));
                        functionArgs.push(stringAsciiCV(message.uuid));
                        functionArgs.push(principalCV(message.targetOptional));
                        break;
                    case "TRANSFER_TOKENS_LTE":
                        // Bound and recipient are in amountOptional/targetOptional
                        if (message.amountOptional === null || message.amountOptional === undefined || message.targetOptional === null || message.targetOptional === undefined || !validateStacksAddress(message.targetOptional)) {
                            throw new Error(`Invalid args for TRANSFER_TOKENS_LTE intent: ${JSON.stringify(message)}`);
                        }
                        functionArgs.push(uintCV(message.amountOptional)); // Bound
                        functionArgs.push(uintCV(message.amountOptional)); // Actual amount (assuming same as bound based on original logic)
                        functionArgs.push(stringAsciiCV(message.uuid));
                        functionArgs.push(principalCV(message.targetOptional));
                        break;
                    case "REDEEM_BEARER":
                        // Amount is in amountOptional, recipient might be targetOptional or defaults to contractAddress
                        if (message.amountOptional === null || message.amountOptional === undefined) {
                            throw new Error(`Invalid args for REDEEM_BEARER intent: ${JSON.stringify(message)}`);
                        }
                        functionArgs.push(uintCV(message.amountOptional));
                        functionArgs.push(stringAsciiCV(message.uuid));
                        functionArgs.push(noneCV());
                        break;
                }

                // Create transaction options (using split address/name)
                const txOptions = {
                    contractAddress: message.contractId.split(".")[0],
                    contractName: message.contractId.split(".")[1],
                    functionName,
                    functionArgs,
                    senderKey: PRIVATE_KEY,
                    network: STACKS_MAINNET,
                    fee: 1000,
                    postConditionMode: PostConditionMode.Deny,
                };

                // Create and sign the transaction
                const transaction = await makeContractCall(txOptions);

                // Broadcast the transaction
                console.log(`CRON: Broadcasting tx for message ${message.uuid} (${message.intent})`);
                const broadcastResponse: TxBroadcastResult = await broadcastTransaction({ transaction });

                // Check for error property directly (acts as type guard)
                if ('error' in broadcastResponse) {
                    // Broadcast failed - Type is narrowed to TxBroadcastResultFail
                    let errorDetails = `Broadcast failed: ${broadcastResponse.error} - ${broadcastResponse.reason}`;
                    // Conditionally add reason_data if it exists
                    if ('reason_data' in broadcastResponse && broadcastResponse.reason_data) {
                        errorDetails += ` ${JSON.stringify(broadcastResponse.reason_data)}`;
                    }
                    throw new Error(errorDetails);
                }

                // If no 'error' property, type is narrowed to TxBroadcastResultOk
                console.log(`CRON: Successfully broadcasted tx ${broadcastResponse.txid} for message ${message.uuid}`);
                processedCount++;
                // Message already removed by RPOP on success

            } catch (error) {
                errorCount++;
                console.error(`CRON: Failed to process message: ${messageJson}`, error);
                // Message was already removed by RPOP, so failed messages are currently dropped.
                // TODO: Implement dead-letter queue or retry logic if needed.
            }
        }

        return NextResponse.json({
            message: `Cron job finished. Processed: ${processedCount}, Errors: ${errorCount}`
        });

    } catch (error) {
        console.error("CRON: Unhandled error during queue processing:", error);
        return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
    }
} 