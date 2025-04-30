import { NextRequest, NextResponse } from 'next/server';
import { getVaultData, saveVaultData } from '@/lib/vaultService';
// import { verifyMessageSignature } from '@stacks/encryption'; // Middleware handles this
import { withAdminAuth } from '@/lib/auth'; // Import the middleware
import { Vault } from '@repo/dexterity';

// Define which fields are allowed to be updated via this API
const ALLOWED_METADATA_FIELDS: ReadonlyArray<keyof Vault> = [
    'name',
    'symbol',
    'description',
    'image',
    'fee',
    'externalPoolId',
    'engineContractId',
    // 'properties' might need careful handling depending on its structure
];

// Define the core handler logic
const handleUpdateMetadata = async (request: NextRequest, { params }: { params: { contractId: string } }) => {
    // Middleware has already authenticated the admin
    const { contractId: vaultId } = await params; // vaultId is the contractId

    if (!vaultId || !vaultId.includes('.')) {
        return NextResponse.json({ success: false, error: 'Invalid vaultId format' }, { status: 400 });
    }

    let newMetadataObject: Partial<Vault>;
    try {
        // Expecting the raw metadata object in the body now
        newMetadataObject = await request.json();
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    // Basic validation that we received an object
    if (typeof newMetadataObject !== 'object' || newMetadataObject === null) {
        return NextResponse.json({ success: false, error: 'Invalid metadata format in body' }, { status: 400 });
    }

    try {
        // --- Fetch Existing Vault Data --- 
        // No need to check ownership here, middleware verified admin status
        const existingVault = await getVaultData(vaultId, true); // Force refresh
        if (!existingVault) {
            return NextResponse.json({ success: false, error: 'Vault not found' }, { status: 404 });
        }

        // --- Merge Allowed Fields --- 
        const mergedVaultData = { ...existingVault };
        let changesMade = false;

        for (const key of ALLOWED_METADATA_FIELDS) {
            if (key in newMetadataObject && newMetadataObject[key] !== existingVault[key]) {
                (mergedVaultData as any)[key] = newMetadataObject[key];
                changesMade = true;
            }
        }

        if (!changesMade) {
            return NextResponse.json({ success: true, message: 'No changes detected', updatedMetadata: existingVault });
        }

        // --- Save Merged Data --- 
        const saved = await saveVaultData(mergedVaultData);
        if (!saved) {
            throw new Error('Failed to save updated vault data to KV store');
        }

        console.log(`Admin successfully updated metadata for vault: ${vaultId}`);
        return NextResponse.json({ success: true, updatedMetadata: mergedVaultData });

    } catch (error) {
        console.error(`Error processing admin metadata update for ${vaultId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
};

// Wrap the handler with the admin authentication middleware
export const POST = withAdminAuth(handleUpdateMetadata); 