import { NextResponse } from 'next/server';
import { getManagedVaultIds } from '@/lib/pool-service';
import { withAdminAuth } from '@/lib/auth';

// TODO: Add authentication/authorization check here for admin access

/**
 * GET /api/v1/admin/vaults
 * Retrieves the list of managed vault contract IDs.
 * Requires admin privileges (checked by withAdminAuth).
 */
const handler = async () => {
    try {
        // TODO: Implement admin check here

        const vaultIds = await getManagedVaultIds();

        if (!vaultIds) {
            // This case might indicate an issue with KV connection or the key itself
            return NextResponse.json({ status: 'error', message: 'Could not retrieve vault list key or key is empty.' }, { status: 500 });
        }

        return NextResponse.json({ status: 'success', data: vaultIds });

    } catch (error) {
        console.error("Error fetching managed vault IDs:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ status: 'error', message: `Failed to fetch vault list: ${errorMessage}` }, { status: 500 });
    }
};

// Wrap the handler with the authentication check
export const GET = withAdminAuth(handler); 