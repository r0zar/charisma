'use server'

import {
    stringAsciiCV, someCV, noneCV, uintCV, principalCV, tupleCV, signStructuredData,
    ClarityValue,
    validateStacksAddress,
    makeContractCall,
    broadcastTransaction,
    PostConditionMode,
    StacksTransactionWire
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET, StacksNetwork } from '@stacks/network';
import { getPublicKeyFromPrivate } from '@stacks/encryption';
import { v4 as uuidv4 } from 'uuid';
import { bufferFromHex } from '@stacks/transactions/dist/cl';
import { kv } from '@vercel/kv';
import { callReadOnlyFunction } from '@repo/polyglot';
import { BLAZE_SIGNER_CONTRACT_ID, BLAZE_SIGNER_PRIVATE_KEY } from './constants';

// ----- CONFIGURATION CONSTANTS -----
const [BLAZE_SIGNER_ADDRESS, BLAZE_SIGNER_NAME] = BLAZE_SIGNER_CONTRACT_ID.split(".");

// ----- TYPES -----
interface BlazeSignedIntentData {
    intent: {
        contract: string;
        intent: string;
        opcode: string | null; // Hex string for opcode
        amount: number | null;
        target: string | null;
        uuid: string;
    };
    sig: string; // Hex string for signature
    pubKey: string;
}

interface IntentRecordData {
    pid: string;
    userId: string;
    tokenAmount: number;
    tokenType: string;
    amount: number; // Fiat amount
    currency: string;
    status: string;
    createdAt: number;
    blaze: BlazeSignedIntentData;
    network?: 'mainnet' | 'testnet';
}

// ----- END TYPES -----

interface BlazeIntentInput {
    contract: string;
    intent: string;
    opcode?: string;
    amount?: number;
    target?: string;
    uuid?: string;
    senderKey: string;
    chainId: number;
}

export async function buildAndSignBlazeIntent(input: BlazeIntentInput): Promise<BlazeSignedIntentData> {
    const uuid = input.uuid || uuidv4();

    const domain = tupleCV({
        name: stringAsciiCV("BLAZE_PROTOCOL"),
        version: stringAsciiCV("v1.0"),
        "chain-id": uintCV(input.chainId),
    });

    const message = tupleCV({
        contract: principalCV(input.contract),
        intent: stringAsciiCV(input.intent),
        opcode: input.opcode ? someCV(bufferFromHex(input.opcode)) : noneCV(),
        amount: typeof input.amount === 'number' ? someCV(uintCV(input.amount)) : noneCV(),
        target: input.target ? someCV(principalCV(input.target)) : noneCV(),
        uuid: stringAsciiCV(uuid),
    });

    const signature = signStructuredData({
        domain,
        message,
        privateKey: input.senderKey,
    });

    return {
        intent: {
            contract: input.contract,
            intent: input.intent,
            opcode: input.opcode !== undefined ? input.opcode : null,
            amount: input.amount !== undefined ? input.amount : null,
            target: input.target !== undefined ? input.target : null,
            uuid,
        },
        sig: signature, // This is a hex string
        pubKey: getPublicKeyFromPrivate(input.senderKey),
    };
}

async function processAndBroadcastBlazeIntent(
    signedIntent: BlazeSignedIntentData,
    networkString: 'mainnet' | 'testnet' = 'mainnet'
): Promise<any> {
    const { intent: intentDetails, sig } = signedIntent;

    if (!BLAZE_SIGNER_PRIVATE_KEY) {
        console.error("BLAZE_SIGNER_PRIVATE_KEY is not set. Cannot broadcast transaction.");
        return { success: false, error: "Server configuration error: Missing private key." };
    }

    let networkInstance: StacksNetwork;
    if (networkString === 'testnet') {
        networkInstance = STACKS_TESTNET;
    } else {
        networkInstance = STACKS_MAINNET;
    }

    let recoveredSignerAddress: string | null = null;
    try {
        const recoverArgs: ClarityValue[] = [
            bufferFromHex(sig.startsWith('0x') ? sig.substring(2) : sig),
            principalCV(intentDetails.contract),
            stringAsciiCV(intentDetails.intent),
            intentDetails.opcode ? someCV(bufferFromHex(intentDetails.opcode)) : noneCV(),
            intentDetails.amount !== null ? someCV(uintCV(intentDetails.amount)) : noneCV(),
            intentDetails.target ? someCV(principalCV(intentDetails.target)) : noneCV(),
            stringAsciiCV(intentDetails.uuid)
        ];
        const recoveredResult = await callReadOnlyFunction(
            BLAZE_SIGNER_ADDRESS, BLAZE_SIGNER_NAME, 'recover', recoverArgs, BLAZE_SIGNER_ADDRESS
        );
        if (recoveredResult && recoveredResult.value && typeof recoveredResult.value === 'string' && validateStacksAddress(recoveredResult.value)) {
            recoveredSignerAddress = recoveredResult.value;
            console.log(`Recovered signer: ${recoveredSignerAddress}.`);
        } else {
            console.warn(`Signer recovery did not yield a valid address:`, recoveredResult);
        }
    } catch (recoverError) {
        console.error("Error during signer recovery:", recoverError);
    }

    try {
        const [contractAddress, contractName] = intentDetails.contract.split('.');
        if (!contractAddress || !contractName) {
            throw new Error(`Invalid contractId format for broadcast: ${intentDetails.contract}`);
        }

        let functionName: string;
        const functionArgs: ClarityValue[] = [];

        functionArgs.push(bufferFromHex(sig.startsWith('0x') ? sig.substring(2) : sig));

        switch (intentDetails.intent) {
            case "TRANSFER_TOKENS":
                functionName = "x-transfer";
                if (intentDetails.amount === null || intentDetails.target === null || !validateStacksAddress(intentDetails.target)) {
                    throw new Error(`Invalid args for TRANSFER_TOKENS: ${JSON.stringify(intentDetails)}`);
                }
                functionArgs.push(uintCV(intentDetails.amount));
                functionArgs.push(stringAsciiCV(intentDetails.uuid));
                functionArgs.push(principalCV(intentDetails.target));
                break;
            case "TRANSFER_TOKENS_LTE":
                functionName = "x-transfer-lte";
                if (intentDetails.amount === null || intentDetails.target === null || !validateStacksAddress(intentDetails.target)) {
                    throw new Error(`Invalid args for TRANSFER_TOKENS_LTE: ${JSON.stringify(intentDetails)}`);
                }
                functionArgs.push(uintCV(intentDetails.amount));
                functionArgs.push(uintCV(intentDetails.amount));
                functionArgs.push(stringAsciiCV(intentDetails.uuid));
                functionArgs.push(principalCV(intentDetails.target));
                break;
            case "REDEEM_BEARER":
                functionName = "x-redeem";
                if (intentDetails.amount === null) {
                    throw new Error(`Invalid args for REDEEM_BEARER: Amount is null. ${JSON.stringify(intentDetails)}`);
                }
                functionArgs.push(uintCV(intentDetails.amount));
                functionArgs.push(stringAsciiCV(intentDetails.uuid));
                functionArgs.push(noneCV());
                break;
            default:
                throw new Error(`Unknown intent for direct broadcast: ${intentDetails.intent}`);
        }

        const txOptions = {
            contractAddress,
            contractName,
            functionName,
            functionArgs,
            senderKey: BLAZE_SIGNER_PRIVATE_KEY,
            network: networkInstance,
            postConditionMode: PostConditionMode.Deny,
        };

        console.log(`Broadcasting Stacks tx for intent ${intentDetails.uuid} (${intentDetails.intent}) to ${intentDetails.contract} calling ${functionName}`);
        const transaction: StacksTransactionWire = await makeContractCall(txOptions);

        // Corrected: broadcastTransaction expects an object with transaction and network
        const broadcastResponse = await broadcastTransaction({ transaction: transaction, network: networkInstance });

        console.log(broadcastResponse);

        return { success: true, ...broadcastResponse }

    } catch (broadcastError: any) {
        console.error("Error during transaction broadcast:", broadcastError);
        return { success: false, error: broadcastError.message || "Failed to broadcast transaction." };
    }
}

export async function processPendingStripeIntents(): Promise<{ id: string, status: string, error?: string, txid?: string, blazeResponse?: any }[]> {
    console.log('Starting direct broadcast of pending Stripe intents...');
    const results: { id: string, status: string, error?: string, txid?: string, blazeResponse?: any }[] = [];
    const allIntentKeys = await kv.keys('intent:*');
    const pendingIntentKeys = [];

    for (const key of allIntentKeys) {
        const intentData = await kv.get<IntentRecordData>(key);
        if (intentData && intentData.status === 'queued') {
            pendingIntentKeys.push(key);
        }
    }
    console.log(`Found ${pendingIntentKeys.length} pending Stripe intents for direct broadcast.`);

    for (const key of pendingIntentKeys) {
        const intentRecord = await kv.get<IntentRecordData>(key);
        if (!intentRecord || !intentRecord.blaze) {
            results.push({ id: intentRecord?.pid || key, status: 'skipped_no_data' });
            continue;
        }
        try {
            console.log(`Processing intent (broadcast): ${intentRecord.pid}`);
            await kv.set(key, { ...intentRecord, status: 'processing_broadcast' });

            const broadcastResult = await processAndBroadcastBlazeIntent(intentRecord.blaze, intentRecord.network || 'mainnet');

            if (broadcastResult.success) {
                console.log(`Successfully broadcasted Blaze intent (broadcast) for ${intentRecord.pid}:`, broadcastResult);
                await kv.set(key, { ...intentRecord, status: 'broadcast_success', txid: broadcastResult.txid, blazeResponse: broadcastResult.data });
                results.push({ id: intentRecord.pid, status: 'broadcast_success', txid: broadcastResult.txid, blazeResponse: broadcastResult.data });
            } else {
                console.error(`Failed to broadcast Blaze intent (broadcast) for ${intentRecord.pid}:`, broadcastResult.error);
                await kv.set(key, { ...intentRecord, status: 'broadcast_failed', error: broadcastResult.error });
                results.push({ id: intentRecord.pid, status: 'broadcast_failed', error: broadcastResult.error });
            }
        } catch (e) {
            const processingError = e instanceof Error ? e.message : 'Unknown processing error';
            console.error(`Unhandled error processing intent (broadcast) ${intentRecord.pid}:`, processingError);
            await kv.set(key, { ...intentRecord, status: 'broadcast_failed', error: processingError });
            results.push({ id: intentRecord.pid, status: 'error_broadcast', error: processingError });
        }
    }
    console.log('Finished direct broadcast of pending Stripe intents.');
    return results;
}

export async function processSingleBlazeIntentByPid(pid: string): Promise<{ id: string, status: string, error?: string, txid?: string, blazeResponse?: any } | null> {
    const intentKey = `intent:${pid}`;
    console.log(`Attempting to manually process intent (manual broadcast) PID: ${pid}`);
    const intentRecord = await kv.get<IntentRecordData>(intentKey);

    if (!intentRecord) {
        return { id: pid, status: 'not_found', error: 'Intent record not found.' };
    }
    if (!intentRecord.blaze) {
        return { id: pid, status: 'skipped_no_blaze_data', error: 'No Blaze data.' };
    }
    if (intentRecord.status === 'broadcast_success' || intentRecord.status === 'broadcast_failed') {
        console.log(`Intent ${pid} is already in a final broadcast state: ${intentRecord.status}.`);
        return { id: pid, status: intentRecord.status, error: 'Intent already broadcast or terminally failed.', txid: (intentRecord as any).txid };
    }

    try {
        console.log(`Processing intent (manual broadcast): ${intentRecord.pid}`);
        const processingRecord = { ...intentRecord, status: 'processing_manual_broadcast' };
        await kv.set(intentKey, processingRecord);

        const broadcastResult = await processAndBroadcastBlazeIntent(intentRecord.blaze, intentRecord.network || 'mainnet');

        if (broadcastResult.success) {
            await kv.set(intentKey, { ...processingRecord, status: 'broadcast_success', txid: broadcastResult.txid, blazeResponse: broadcastResult.data, processedAt: Date.now() });
            return { id: intentRecord.pid, status: 'broadcast_success', txid: broadcastResult.txid, blazeResponse: broadcastResult.data };
        } else {
            await kv.set(intentKey, { ...processingRecord, status: 'broadcast_failed', error: broadcastResult.error, blazeResponse: broadcastResult.data, lastAttemptAt: Date.now() });
            return { id: intentRecord.pid, status: 'broadcast_failed', error: broadcastResult.error, blazeResponse: broadcastResult.data };
        }
    } catch (e) {
        const processingError = e instanceof Error ? e.message : 'Unknown processing error';
        await kv.set(intentKey, { ...intentRecord, status: 'broadcast_failed', error: processingError, lastAttemptAt: Date.now() });
        return { id: pid, status: 'error_broadcast', error: processingError };
    }
}
