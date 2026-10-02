import { NextResponse } from 'next/server';
import { verifySignedRequestWithTimestamp } from 'blaze-sdk';
import { ADMIN_ADDRESS, ADMIN_MESSAGE } from './admin';

/**
 * Admin routes answer only the admin wallet, signing ADMIN_MESSAGE with a timestamp (blaze-sdk signedFetchWithTimestamp).
 * Returns the error response to send, or null when the caller is the admin.
 */
export async function requireAdmin(req: Request): Promise<NextResponse | null> {
    const auth = await verifySignedRequestWithTimestamp(req, { message: ADMIN_MESSAGE, expectedAddress: ADMIN_ADDRESS });
    return auth.ok ? null : NextResponse.json({ error: auth.error }, { status: auth.status });
}
