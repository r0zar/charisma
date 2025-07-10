import { verifyMessageSignatureRsv } from '@stacks/encryption';
import { getAddressFromPublicKey } from '@stacks/transactions';
import { STACKS_MAINNET, type StacksNetwork } from '@stacks/network';
import { SIG_HEADER, PUB_HEADER, TIMESTAMP_HEADER } from './headers';

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

export interface TimestampedSignerAuthOptions {
    /** The exact message that must have been signed. */
    message: string;
    /** Expected principal address that must match the signer. */
    expectedAddress: string;
    /** Time-to-live in minutes (default: 5) */
    ttl?: number;
    /** Optional network (defaults to mainnet). */
    network?: StacksNetwork;
    /** Override header names (lower-case). */
    headers?: {
        sig?: string;
        pub?: string;
    };
}

export interface TimestampedSignatureVerificationOptions {
    /** The exact message that must have been signed. */
    message: string;
    /** Time-to-live in minutes (default: 5) */
    ttl?: number;
    /** Optional network (defaults to mainnet). */
    network?: StacksNetwork;
    /** Override header names (lower-case). */
    headers?: {
        sig?: string;
        pub?: string;
    };
}

interface TimestampedMessage {
    message: string;
    timestamp: number;
}

/**
 * Validates a timestamped message is within the TTL window
 */
function validateTimestamp(timestampedMessage: TimestampedMessage, ttl: number = 5): boolean {
    const now = Date.now();
    const messageTime = timestampedMessage.timestamp;
    const maxAge = ttl * 60 * 1000; // Convert minutes to milliseconds
    
    return (now - messageTime) <= maxAge;
}

/**
 * Parses and validates a timestamped message
 */
function parseTimestampedMessage(signedMessage: string): TimestampedMessage | null {
    try {
        const parsed = JSON.parse(signedMessage);
        if (typeof parsed.message === 'string' && typeof parsed.timestamp === 'number') {
            return parsed as TimestampedMessage;
        }
        return null;
    } catch {
        return null;
    }
}

export async function verifySignedRequestWithTimestamp(
    req: Request,
    opts: TimestampedSignerAuthOptions,
): Promise<SignerAuthResult> {
    const { expectedAddress, ...verificationOpts } = opts;

    const verificationResult = await verifySignatureAndGetSignerWithTimestamp(req, verificationOpts);

    if (!verificationResult.ok) {
        return verificationResult; // Forward the error (status 401)
    }

    // Signature is valid, now check if the signer matches the expected address
    if (verificationResult.signer !== expectedAddress) {
        return { ok: false, status: 403, error: 'Not authorised' };
    }

    return { ok: true, signer: verificationResult.signer };
}

export async function verifySignatureAndGetSignerWithTimestamp(
    req: Request,
    opts: TimestampedSignatureVerificationOptions,
): Promise<SignatureVerificationResult> {
    const {
        message,
        ttl = 5,
        network = STACKS_MAINNET,
        headers: hdr = {},
    } = opts;

    const sigHeader = (hdr.sig ?? SIG_HEADER).toLowerCase();
    const pubHeader = (hdr.pub ?? PUB_HEADER).toLowerCase();
    const timestampHeader = TIMESTAMP_HEADER.toLowerCase();

    const signature = req.headers.get(sigHeader);
    const publicKey = req.headers.get(pubHeader);
    const timestampStr = req.headers.get(timestampHeader);

    if (!signature || !publicKey) {
        return { ok: false, status: 401, error: 'Missing authentication headers', signer: '' };
    }

    if (!timestampStr) {
        return { ok: false, status: 401, error: 'Missing timestamp header', signer: '' };
    }

    // Parse and validate timestamp
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
        return { ok: false, status: 401, error: 'Invalid timestamp format', signer: '' };
    }

    // Validate timestamp is within TTL window
    const now = Date.now();
    const maxAge = ttl * 60 * 1000; // Convert minutes to milliseconds
    if ((now - timestamp) > maxAge) {
        return { ok: false, status: 401, error: 'Message expired', signer: '' };
    }

    // Reconstruct the timestamped message that was signed
    const timestampedMessage = JSON.stringify({ message, timestamp });
    
    // Verify the signature
    const valid = verifyMessageSignatureRsv({ 
        message: timestampedMessage, 
        publicKey, 
        signature 
    });
    
    if (!valid) {
        return { ok: false, status: 401, error: 'Invalid signature', signer: '' };
    }

    const signer = getAddressFromPublicKey(publicKey, network as any);
    return { ok: true, signer, status: 200 };
} 