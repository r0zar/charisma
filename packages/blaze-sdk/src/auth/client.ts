import { request } from '@stacks/connect';
import { SIG_HEADER, PUB_HEADER } from './headers';

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