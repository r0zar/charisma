import { NextRequest, NextResponse } from 'next/server';
import { getVaultData, saveVaultData } from '@/lib/pool-service';
// import { verifyMessageSignature } from '@stacks/encryption'; // Middleware handles this
import { withAdminAuth } from '@/lib/auth'; // Import the middleware
import { revalidatePath } from 'next/cache'; // Import revalidatePath

interface Vault {
    name: string;
    symbol: string;
    description: string;
    image: string;
    fee: number;
    externalPoolId: string;
    engineContractId: string;
}

// Define the core handler logic
const handleUpdateMetadata = async (request: NextRequest, { params }: { params: { contractId: string } }) => {
    // Middleware has already authenticated the admin
    const { contractId: vaultId } = await params; // vaultId is the contractId

    if (!vaultId || !vaultId.includes('.')) {
        return NextResponse.json({ success: false, error: 'Invalid vaultId format' }, { status: 400 });
    }

    let newMetadataObject: Record<string, any>; // Use a more general type now
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

        // --- Merge Submitted Data --- 
        // Perform a shallow merge. Any key in newMetadataObject will overwrite the existing one.
        // Be cautious: This could overwrite critical fields if they are included in the request body.
        const mergedVaultData = {
            ...existingVault,
            ...newMetadataObject
        };

        // --- Check if changes were actually made --- 
        // Compare stringified versions to see if the merged data is different from the original.
        // This prevents unnecessary saves and cache revalidations.
        if (JSON.stringify(existingVault) === JSON.stringify(mergedVaultData)) {
            console.log(`No effective changes detected for vault: ${vaultId}`);
            return NextResponse.json({
                success: true,
                message: 'No effective changes detected',
                updatedMetadata: existingVault
            });
        }

        // --- Save Merged Data --- 
        const saved = await saveVaultData(mergedVaultData);
        if (!saved) {
            throw new Error('Failed to save updated vault data to KV store');
        }

        // --- Invalidate Cache --- 
        // Use revalidatePath to clear the cache for the specific vault page
        const vaultPagePath = `/vaults/${vaultId}`;
        revalidatePath(vaultPagePath, 'page'); // Invalidate the page cache
        console.log(`Cache revalidated for path: ${vaultPagePath}`);

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