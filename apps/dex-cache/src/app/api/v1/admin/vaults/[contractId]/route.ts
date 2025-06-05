import { NextResponse, NextRequest } from 'next/server';
import { getVaultData, saveVaultData } from '@/lib/pool-service';
import { withAdminAuth } from '@/lib/auth'; // Import the HOF

// TODO: Add authentication/authorization check here for admin access

interface VaultParams {
    params: {
        contractId: string;
    };
}

/**
 * GET /api/v1/admin/vaults/[contractId]
 * Retrieves the full data for a specific vault.
 * Requires admin privileges.
 */
const getHandler = async (request: NextRequest, { params }: VaultParams) => {
    const { contractId } = params;

    if (!contractId) {
        return NextResponse.json({ status: 'error', message: 'Contract ID is required' }, { status: 400 });
    }

    // Basic validation, can be enhanced
    if (!contractId.includes('.')) {
        return NextResponse.json({ status: 'error', message: 'Invalid Contract ID format' }, { status: 400 });
    }

    try {
        const vaultData = await getVaultData(contractId);

        if (!vaultData) {
            return NextResponse.json({ status: 'error', message: `Vault not found or failed to fetch: ${contractId}` }, { status: 404 });
        }

        return NextResponse.json({ status: 'success', data: vaultData });

    } catch (error) {
        console.error(`Error fetching vault data for ${contractId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ status: 'error', message: `Failed to fetch vault ${contractId}: ${errorMessage}` }, { status: 500 });
    }
};


/**
 * PATCH /api/v1/admin/vaults/[contractId]
 * Updates specific properties of a vault.
 * Requires admin privileges.
 * Expects a JSON body with properties to update.
 */
const patchHandler = async (request: NextRequest, { params }: VaultParams) => {
    const { contractId } = params;

    if (!contractId) {
        return NextResponse.json({ status: 'error', message: 'Contract ID is required' }, { status: 400 });
    }
    if (!contractId.includes('.')) {
        return NextResponse.json({ status: 'error', message: 'Invalid Contract ID format' }, { status: 400 });
    }

    let updates: Partial<any>;
    try {
        updates = await request.json();
    } catch (error) {
        return NextResponse.json({ status: 'error', message: 'Invalid JSON body provided' }, { status: 400 });
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ status: 'error', message: 'No update data provided' }, { status: 400 });
    }

    // Prevent critical fields from being patched directly this way
    const forbiddenUpdates = ['contractId', 'contractAddress', 'contractName', 'tokenA', 'tokenB', 'reservesA', 'reservesB', 'reservesLastUpdatedAt'];
    const requestedUpdateKeys = Object.keys(updates);
    if (requestedUpdateKeys.some(key => forbiddenUpdates.includes(key))) {
        return NextResponse.json({ status: 'error', message: `Cannot update restricted fields: ${forbiddenUpdates.join(', ')}` }, { status: 400 });
    }


    try {
        // 1. Fetch the current vault data (using getVaultData ensures we work with potentially refreshed data)
        const currentVault = await getVaultData(contractId);

        if (!currentVault) {
            return NextResponse.json({ status: 'error', message: `Vault not found: ${contractId}` }, { status: 404 });
        }

        // 2. Apply the updates
        const updatedVaultData = {
            ...currentVault,
            ...updates,
            reservesLastUpdatedAt: (currentVault as any).reservesLastUpdatedAt || undefined
        };

        // 3. Save the updated vault data
        const saved = await saveVaultData(updatedVaultData);

        if (!saved) {
            return NextResponse.json({ status: 'error', message: `Failed to save updates for vault ${contractId}` }, { status: 500 });
        }

        // 4. Return the updated vault data
        const finalVaultData = await getVaultData(contractId);


        return NextResponse.json({ status: 'success', data: finalVaultData });

    } catch (error) {
        console.error(`Error updating vault ${contractId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ status: 'error', message: `Failed to update vault ${contractId}: ${errorMessage}` }, { status: 500 });
    }
};

// Wrap handlers with the authentication check
export const GET = withAdminAuth(getHandler);
export const PATCH = withAdminAuth(patchHandler); 