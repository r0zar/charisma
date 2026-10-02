import { NextResponse } from 'next/server';
import { verifySignedRequestWithTimestamp } from 'blaze-sdk';
import { ADMIN_ADDRESS } from '@/lib/constants';
import { ADMIN_AUTH_MESSAGE } from '@/lib/admin-config';

/**
 * Admin endpoints answer only the admin wallet. The browser signs ADMIN_AUTH_MESSAGE with a timestamp
 * (blaze-sdk signedFetchWithTimestamp); returns the error response to send, or null when the caller is the admin.
 */
export async function requireAdmin(req: Request): Promise<NextResponse | null> {
    const auth = await verifySignedRequestWithTimestamp(req, { message: ADMIN_AUTH_MESSAGE, expectedAddress: ADMIN_ADDRESS });
    return auth.ok ? null : NextResponse.json({ error: auth.error }, { status: auth.status });
}
