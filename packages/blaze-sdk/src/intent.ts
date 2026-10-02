import { Cl, optionalCVOf, privateKeyToPublic, signStructuredData, TupleCV } from "@stacks/transactions";
import { noneCV, principalCV, someCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { MULTIHOP_CONTRACT_ID } from "./constants";
import { blazeDomain, blazeVersionOf } from "./version";
import { getSelectedProviderId, request } from "@stacks/connect";

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
        opcode: input.opcode ? someCV(Cl.bufferFromHex(input.opcode)) : noneCV(),
        amount: input.amount ? someCV(uintCV(input.amount)) : noneCV(),
        target: input.target ? someCV(principalCV(input.target)) : noneCV(),
        uuid: stringAsciiCV(uuid),
    });

    const signature = signStructuredData({
        domain: blazeDomain(await blazeVersionOf(input.contract)),
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
        opcode: input.opcode ? someCV(Cl.bufferFromHex(input.opcode)) : noneCV(),
        amount: input.amount ? someCV(uintCV(input.amount)) : noneCV(),
        target: input.target ? someCV(principalCV(input.target)) : noneCV(),
        uuid: stringAsciiCV(uuid),
    });

    const { request } = await import('@stacks/connect');
    const domain = blazeDomain(await blazeVersionOf(input.contract));
    const { signature, publicKey } = await request('stx_signStructuredMessage', { domain, message });

    return {
        message,
        signature,
        publicKey
    };
}

export interface TriggeredSwapInput {
    subnet: string;
    uuid: string;
    amount: bigint; // already in micro units
    multihopContractId?: string;
    intent?: string;
}

/** The Blaze message a triggered swap signs */
function triggeredSwapMessage({ subnet, uuid, amount, multihopContractId = MULTIHOP_CONTRACT_ID, intent = 'TRANSFER_TOKENS' }: TriggeredSwapInput) {
    return tupleCV({
        contract: principalCV(subnet),
        intent: stringAsciiCV(intent),
        opcode: noneCV(),
        amount: optionalCVOf(uintCV(amount)),
        target: optionalCVOf(principalCV(multihopContractId)),
        uuid: stringAsciiCV(uuid),
    });
}

export async function signTriggeredSwap(input: TriggeredSwapInput): Promise<string> {
    // @ts-ignore – upstream types don't include method yet
    const domain = blazeDomain(await blazeVersionOf(input.subnet));
    const res = await request('stx_signStructuredMessage', { domain, message: triggeredSwapMessage(input) });
    if (!res?.signature) throw new Error('User cancelled the signature');
    return res.signature as string; // raw 65-byte hex
}

/** Provider id Blaze Wallet registers with @stacks/connect */
export const BLAZE_WALLET_PROVIDER_ID = 'SignetProvider';

/** Whether the connected wallet can sign many orders from one approval (Blaze Wallet) */
export const canSignInBulk = () => getSelectedProviderId() === BLAZE_WALLET_PROVIDER_ID;

/**
 * Sign many triggered swaps from one approval (blaze_signStructuredMessages, see WALLET-SPEC.md).
 * Only Blaze Wallet supports it; check canSignInBulk() first. Signatures come back in order.
 */
export async function signTriggeredSwaps(inputs: TriggeredSwapInput[]): Promise<string[]> {
    if (!canSignInBulk()) throw new Error('Signing many orders at once needs Blaze Wallet');
    const versions = new Set(await Promise.all(inputs.map(i => blazeVersionOf(i.subnet))));
    if (versions.size > 1) throw new Error('Orders on v1 and v2 subnets need separate approvals');
    const domain = blazeDomain([...versions][0] ?? 1);
    const res = await request(
        // @ts-ignore – a Blaze wallet method, not in @stacks/connect's list
        'blaze_signStructuredMessages',
        { domain: Cl.serialize(domain), messages: inputs.map(input => Cl.serialize(triggeredSwapMessage(input))) },
    ) as { signatures?: string[] };
    if (!res?.signatures || res.signatures.length !== inputs.length) throw new Error('The wallet did not sign every order');
    return res.signatures;
}
