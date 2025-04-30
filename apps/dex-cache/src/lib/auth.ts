import { type NextRequest, NextResponse } from 'next/server';
import { getAddressFromPublicKey } from '@stacks/transactions';
import { verifyMessageSignatureRsv } from '@stacks/encryption';

// The message that the admin must sign
// Using a constant string simplifies things for now.
// Consider adding a timestamp or nonce for replay protection if needed.
const ADMIN_AUTH_MESSAGE = "dex-cache-admin-access";

type ApiHandler = (req: NextRequest, context: any) => Promise<NextResponse> | NextResponse;

/**
 * Higher-Order Function to wrap API route handlers with admin authentication.
 * Checks for 'x-public-key' and 'x-signature' headers.
 * Verifies the signature against the ADMIN_AUTH_MESSAGE and compares
 * the derived address to the ADMIN_WALLET_ADDRESS environment variable.
 */
export function withAdminAuth(handler: ApiHandler): ApiHandler {
    return async (req: NextRequest, context: any) => {
        const adminAddress = process.env.ADMIN_WALLET_ADDRESS || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

        if (!adminAddress) {
            console.error("ADMIN_WALLET_ADDRESS environment variable is not set.");
            return NextResponse.json(
                { status: 'error', message: 'Server configuration error.' },
                { status: 500 }
            );
        }

        const signature = req.headers.get('x-signature');
        const publicKey = req.headers.get('x-public-key');

        if (!signature || !publicKey) {
            return NextResponse.json(
                { status: 'error', message: 'Missing authentication headers (x-public-key, x-signature)' },
                { status: 401 }
            );
        }

        try {
            // Verify the signature
            const isValidSig = verifyMessageSignatureRsv({
                message: ADMIN_AUTH_MESSAGE,
                publicKey: publicKey,
                signature: signature,
            });

            if (!isValidSig) {
                console.warn(`Invalid admin signature received. PubKey: ${publicKey.substring(0, 10)}...`);
                return NextResponse.json(
                    { status: 'error', message: 'Invalid signature' },
                    { status: 401 }
                );
            }

            // Derive address from public key
            // Assuming Mainnet - adjust if necessary (e.g., TransactionVersion.Testnet)
            const signerAddress = getAddressFromPublicKey(publicKey, 'mainnet');

            // Check if the signer is the configured admin
            if (signerAddress !== adminAddress) {
                console.warn(`Unauthorized admin access attempt by address: ${signerAddress}`);
                return NextResponse.json(
                    { status: 'error', message: 'Unauthorized' },
                    { status: 403 }
                );
            }

            // If all checks pass, proceed to the original handler
            console.log(`Admin access granted to ${signerAddress} for ${req.nextUrl.pathname}`);
            return handler(req, context);

        } catch (error) {
            console.error("Error during admin authentication:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            return NextResponse.json(
                { status: 'error', message: `Authentication error: ${errorMessage}` },
                { status: 500 }
            );
        }
    };
} 