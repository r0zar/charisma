import { request } from '@stacks/connect';
import { SIG_HEADER, PUB_HEADER, TIMESTAMP_HEADER } from './headers';

export interface SignedMessage {
    signature: string;
    publicKey: string;
}

/**
 * Opens the Stacks wallet and asks the user to sign an arbitrary string.
 * Returns the signature & public key that should accompany API requests.
 */
export async function signMessage(message: string): Promise<SignedMessage> {
    const res = await request('stx_signMessage', { message });

    if (!res || !res.signature || !res.publicKey) {
        throw new Error('Failed to sign message');
    }
    return { signature: res.signature, publicKey: res.publicKey };
}

/**
 * Convenience helper – turn the signature into the headers expected by
 * verifySignedRequest.
 */
export function buildSignatureHeaders({ signature, publicKey }: SignedMessage) {
    return {
        [SIG_HEADER]: signature,
        [PUB_HEADER]: publicKey,
    } as Record<string, string>;
}

/**
 * Convenience helper for timestamped signatures – includes timestamp header
 */
export function buildTimestampedSignatureHeaders({ signature, publicKey, timestamp }: SignedMessageWithTimestamp) {
    return {
        [SIG_HEADER]: signature,
        [PUB_HEADER]: publicKey,
        [TIMESTAMP_HEADER]: timestamp.toString(),
    } as Record<string, string>;
}

/**
 * Fetch wrapper that automatically prompts the wallet to sign `opts.message`
 * and attaches the required headers.
 */
export async function signedFetch(
    input: RequestInfo | URL,
    opts: (RequestInit & { message: string })
): Promise<Response> {
    const { message, headers: existingHeaders, ...rest } = opts;

    // Sign the provided message
    const signed = await signMessage(message);
    const sigHeaders = buildSignatureHeaders(signed);

    // Merge headers (existing headers take precedence if they collide).
    const mergedHeaders: Record<string, string> = {
        ...sigHeaders,
        ...(() => {
            if (existingHeaders instanceof Headers) {
                const obj: Record<string, string> = {};
                existingHeaders.forEach((v, k) => (obj[k] = v));
                return obj;
            }
            return existingHeaders as Record<string, string> | undefined;
        })(),
    };

    return fetch(input, {
        ...rest,
        headers: mergedHeaders,
    });
}

export interface TimestampedAuthOptions {
    /** Time-to-live in minutes (default: 5) */
    ttl?: number;
}

export interface TimestampedMessage {
    message: string;
    timestamp: number;
}

/**
 * Creates a timestamped message object to prevent replay attacks
 */
export function createTimestampedMessage(message: string, ttl: number = 5): TimestampedMessage {
    return {
        message,
        timestamp: Date.now()
    };
}

export interface SignedMessageWithTimestamp extends SignedMessage {
    timestamp: number;
}

/**
 * Signs a message with a timestamp to prevent replay attacks
 */
export async function signMessageWithTimestamp(
    message: string, 
    options: TimestampedAuthOptions = {}
): Promise<SignedMessageWithTimestamp> {
    const { ttl = 5 } = options;
    const timestampedMessage = createTimestampedMessage(message, ttl);
    const signed = await signMessage(JSON.stringify(timestampedMessage));
    return {
        ...signed,
        timestamp: timestampedMessage.timestamp
    };
}

/**
 * Fetch wrapper that automatically prompts the wallet to sign a timestamped message
 */
export async function signedFetchWithTimestamp(
    input: RequestInfo | URL,
    opts: (RequestInit & { message: string } & TimestampedAuthOptions)
): Promise<Response> {
    const { message, ttl, headers: existingHeaders, ...rest } = opts;

    // Sign the timestamped message
    const signed = await signMessageWithTimestamp(message, { ttl });
    const sigHeaders = buildTimestampedSignatureHeaders(signed);

    // Merge headers (existing headers take precedence if they collide).
    const mergedHeaders: Record<string, string> = {
        ...sigHeaders,
        ...(() => {
            if (existingHeaders instanceof Headers) {
                const obj: Record<string, string> = {};
                existingHeaders.forEach((v, k) => (obj[k] = v));
                return obj;
            }
            return existingHeaders as Record<string, string> | undefined;
        })(),
    };

    return fetch(input, {
        ...rest,
        headers: mergedHeaders,
    });
} 