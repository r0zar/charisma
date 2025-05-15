import { privateKeyToPublic, signStructuredData, TupleCV } from "@stacks/transactions";
import { noneCV, principalCV, someCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { bufferFromHex } from "@stacks/transactions/dist/cl";
import { BLAZE_V1_DOMAIN } from "./constants";
import { randomUUID } from "crypto";

export interface IntentInput {
    contract: string;
    intent: string;
    opcode?: string;
    amount?: number;
    target?: string;
    uuid?: string;
}

export interface SecureIntentInput extends IntentInput {
    senderKey: string;
}

export interface SignedIntent {
    message: TupleCV;
    signature: string;
    publicKey: string | Uint8Array;
}

export async function signIntentWithPrivateKey(input: SecureIntentInput): Promise<SignedIntent> {
    const uuid = input.uuid || randomUUID();

    const message = tupleCV({
        contract: principalCV(input.contract),
        intent: stringAsciiCV(input.intent),
        opcode: input.opcode ? someCV(bufferFromHex(input.opcode)) : noneCV(),
        amount: typeof input.amount === 'number' ? someCV(uintCV(input.amount)) : noneCV(),
        target: input.target ? someCV(principalCV(input.target)) : noneCV(),
        uuid: stringAsciiCV(uuid),
    });

    const signature = signStructuredData({
        domain: BLAZE_V1_DOMAIN,
        message,
        privateKey: input.senderKey,
    });

    const publicKey = privateKeyToPublic(input.senderKey);

    return {
        message,
        signature,
        publicKey,
    };
}

export async function signIntentWithWallet(input: IntentInput): Promise<SignedIntent> {
    const uuid = input.uuid || randomUUID();

    const message = tupleCV({
        contract: principalCV(input.contract),
        intent: stringAsciiCV(input.intent),
        opcode: input.opcode ? someCV(bufferFromHex(input.opcode)) : noneCV(),
        amount: typeof input.amount === 'number' ? someCV(uintCV(input.amount)) : noneCV(),
        target: input.target ? someCV(principalCV(input.target)) : noneCV(),
        uuid: stringAsciiCV(uuid),
    });

    const { request } = await import('@stacks/connect');
    const { signature, publicKey } = await request('stx_signStructuredMessage', { domain: BLAZE_V1_DOMAIN, message });

    return {
        message,
        signature,
        publicKey
    };
}