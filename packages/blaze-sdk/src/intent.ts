import { optionalCVOf, privateKeyToPublic, signStructuredData, TupleCV } from "@stacks/transactions";
import { noneCV, principalCV, someCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { bufferFromHex } from "@stacks/transactions/dist/cl";
import { BLAZE_V1_DOMAIN, MULTIHOP_CONTRACT_ID } from "./constants";
import { request } from "@stacks/connect";

export interface IntentInput {
    contract: string;
    intent: string;
    opcode?: string;
    amount?: number;
    target?: string;
    uuid: string;
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
    const uuid = input.uuid;

    const message = tupleCV({
        contract: principalCV(input.contract),
        intent: stringAsciiCV(input.intent),
        opcode: input.opcode ? someCV(bufferFromHex(input.opcode)) : noneCV(),
        amount: input.amount ? someCV(uintCV(input.amount)) : noneCV(),
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
    const uuid = input.uuid;

    const message = tupleCV({
        contract: principalCV(input.contract),
        intent: stringAsciiCV(input.intent),
        opcode: input.opcode ? someCV(bufferFromHex(input.opcode)) : noneCV(),
        amount: input.amount ? someCV(uintCV(input.amount)) : noneCV(),
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

export async function signTriggeredSwap({
    subnet,
    uuid,
    amount,
    multihopContractId = MULTIHOP_CONTRACT_ID,
    intent = 'TRANSFER_TOKENS',
}: {
    subnet: string;
    uuid: string;
    amount: bigint; // already in micro units
    multihopContractId?: string;
    intent?: string;
}): Promise<string> {
    const message = tupleCV({
        contract: principalCV(subnet),
        intent: stringAsciiCV(intent),
        opcode: noneCV(),
        amount: optionalCVOf(uintCV(amount)),
        target: optionalCVOf(principalCV(multihopContractId)),
        uuid: stringAsciiCV(uuid),
    });

    // @ts-ignore – upstream types don't include method yet
    const res = await request('stx_signStructuredMessage', { domain: BLAZE_V1_DOMAIN, message });
    if (!res?.signature) throw new Error('User cancelled the signature');
    return res.signature as string; // raw 65-byte hex
}