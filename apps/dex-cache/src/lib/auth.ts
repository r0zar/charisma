import { type NextRequest, NextResponse } from 'next/server';
import { verifySignedRequestWithTimestamp } from 'blaze-sdk';

/** What the admin signs, with a timestamp (blaze-sdk's signedFetchWithTimestamp); a signature is good for 5 minutes */
export const ADMIN_AUTH_MESSAGE = "dex-cache-admin-access";

type ApiHandler = (req: NextRequest, context: any) => Promise<NextResponse> | NextResponse;

/**
 * Wraps an API route so only the admin wallet can call it. The request carries x-signature, x-public-key and
 * x-timestamp over {message: ADMIN_AUTH_MESSAGE, timestamp}: it expires after 5 minutes and can't be dated in the
 * future, so a captured signature can't be replayed later.
 */
export function withAdminAuth(handler: ApiHandler): ApiHandler {
    return async (req: NextRequest, context: any) => {
        const adminAddress = process.env.ADMIN_WALLET_ADDRESS || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
        const auth = await verifySignedRequestWithTimestamp(req, { message: ADMIN_AUTH_MESSAGE, expectedAddress: adminAddress });
        if (!auth.ok) {
            console.warn(`Admin access refused for ${req.nextUrl.pathname}: ${auth.error}`);
            return NextResponse.json({ status: 'error', message: auth.error }, { status: auth.status });
        }
        return handler(req, context);
    };
}
