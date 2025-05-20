import { verifyMessageSignatureRsv } from '@stacks/encryption';
import { getAddressFromPublicKey } from '@stacks/transactions';
import { STACKS_MAINNET, type StacksNetwork } from '@stacks/network';
import { SIG_HEADER, PUB_HEADER } from './headers';

export interface SignerAuthOptions {
    /** The exact message that must have been signed. */
    message: string;
    /** Expected principal address that must match the signer. */
    expectedAddress: string;
    /** Optional network (defaults to mainnet). */
    network?: StacksNetwork;
    /** Override header names (lower-case). */
    headers?: {
        sig?: string;
        pub?: string;
    };
}

export type SignerAuthResult =
    | { ok: true; signer: string }
    | { ok: false; status: 401 | 403; error: string };

export interface SignatureVerificationOptions {
    /** The exact message that must have been signed. */
    message: string;
    /** Optional network (defaults to mainnet). */
    network?: StacksNetwork;
    /** Override header names (lower-case). */
    headers?: {
        sig?: string;
        pub?: string;
    };
}

export type SignatureVerificationResult =
    | { ok: true; signer: string, status: 200 }
    | { ok: false; status: 401 | 403; error: string, signer: string };

export async function verifySignedRequest(
    req: Request,
    opts: SignerAuthOptions,
): Promise<SignerAuthResult> {
    const { expectedAddress, ...verificationOpts } = opts;

    const verificationResult = await verifySignatureAndGetSigner(req, verificationOpts);

    if (!verificationResult.ok) {
        return verificationResult; // Forward the error (status 401)
    }

    // Signature is valid, now check if the signer matches the expected address
    if (verificationResult.signer !== expectedAddress) {
        return { ok: false, status: 403, error: 'Not authorised' };
    }

    return { ok: true, signer: verificationResult.signer };
}

export async function verifySignatureAndGetSigner(
    req: Request,
    opts: SignatureVerificationOptions,
): Promise<SignatureVerificationResult> {
    const {
        message,
        network = STACKS_MAINNET,
        headers: hdr = {},
    } = opts;

    const sigHeader = (hdr.sig ?? SIG_HEADER).toLowerCase();
    const pubHeader = (hdr.pub ?? PUB_HEADER).toLowerCase();

    const signature = req.headers.get(sigHeader);
    const publicKey = req.headers.get(pubHeader);

    if (!signature || !publicKey) {
        return { ok: false, status: 401, error: 'Missing authentication headers', signer: '' };
    }

    const valid = verifyMessageSignatureRsv({ message, publicKey, signature });
    if (!valid) {
        return { ok: false, status: 401, error: 'Invalid signature', signer: '' };
    }

    const signer = getAddressFromPublicKey(publicKey, network as any); // network will have a default
    return { ok: true, signer, status: 200 };
} 