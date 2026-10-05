import { createHash } from 'node:crypto';
import { Cl, encodeStructuredDataBytes, getAddressFromPublicKey, publicKeyFromSignatureRsv } from '@stacks/transactions';
import { blazeDomain, blazeVersionOf } from 'blaze-sdk';

/** A Blaze intent as a subnet's x- functions receive it: no opcode, an amount and a target */
export interface SignedIntent {
    signature: string;
    /** The subnet the intent spends */
    contract: string;
    /** e.g. TRANSFER_TOKENS or TRANSFER_TOKENS_LTE */
    intent: string;
    amount: bigint;
    /** The router (orders) or the recipient (transfers) */
    target: string;
    uuid: string;
}

/**
 * Who signed a Blaze intent, recovered offline from the signature over the message the subnet checks, under the
 * domain of the Blaze version that subnet uses. No network call for any subnet blaze-sdk already knows.
 */
export async function intentSigner({ signature, contract, intent, amount, target, uuid }: SignedIntent): Promise<string> {
    const message = Cl.tuple({
        contract: Cl.principal(contract),
        intent: Cl.stringAscii(intent),
        opcode: Cl.none(),
        amount: Cl.some(Cl.uint(amount)),
        target: Cl.some(Cl.principal(target)),
        uuid: Cl.stringAscii(uuid),
    });
    const domain = blazeDomain(await blazeVersionOf(contract));
    const hash = createHash('sha256').update(encodeStructuredDataBytes({ message, domain })).digest('hex');
    return getAddressFromPublicKey(publicKeyFromSignatureRsv(hash, signature.replace(/^0x/, '')), 'mainnet');
}
