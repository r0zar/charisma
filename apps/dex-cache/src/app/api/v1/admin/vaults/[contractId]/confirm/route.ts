import { type NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { saveVaultData } from "@/lib/pool-service";
import { revalidatePath } from 'next/cache';

// Define the expected structure for token data
interface TokenData {
    contractId: string;
    name: string;
    symbol: string;
    decimals: number;
    identifier?: string;
    description?: string;
    image?: string;
    // Add any other relevant fields from your Token type
}

// Updated RequestBody - tokens A and B are now optional
interface RequestBody {
    lpToken: TokenData & {
        lpRebatePercent?: number,
        externalPoolId?: string,
        engineContractId?: string,
        type?: string,
        protocol?: string
    };
    tokenA?: TokenData; // Now optional
    tokenB?: TokenData; // Now optional
    additionalData?: Record<string, any>; // Optional additional data
}

// Define the structure for the final Vault object with updated fields
interface Vault {
    type: string; // e.g., 'POOL', 'SUBLINK', 'VAULT', 'OTHER'
    protocol: string; // e.g., 'CHARISMA', 'ARKADIKO', etc.
    contractId: string;
    contractAddress: string;
    contractName: string;
    name: string;
    symbol: string;
    decimals: number;
    identifier: string;
    description: string;
    image: string;
    fee: number;
    externalPoolId: string;
    engineContractId: string;
    tokenA?: TokenData; // Now optional
    tokenB?: TokenData; // Now optional
    tokenBContract?: string; // For SUBLINK type
    reservesA?: number; // Now optional
    reservesB?: number; // Now optional
    additionalData?: Record<string, any>; // Optional additional data
}

// Updated handler signature to accept params
async function confirmVaultHandler(req: NextRequest, { params }: { params: { contractId: string } }) {
    try {
        // Get contractId from URL parameters
        const { contractId } = params;
        console.log(`API: Confirming vault (dynamic route): ${contractId}`);

        // Get other data from request body
        const requestBody = await req.json() as RequestBody;
        const { lpToken, tokenA, tokenB, additionalData } = requestBody;

        // Validation: check contractId from params
        if (!contractId || !contractId.includes('.')) {
            return NextResponse.json({ status: 'error', message: 'Invalid contractId in URL path.' }, { status: 400 });
        }

        // lpToken is required for all vault types
        if (!lpToken) {
            return NextResponse.json({ status: 'error', message: 'Missing required lpToken data in request body.' }, { status: 400 });
        }

        // Determine vault type (default to POOL if not specified)
        const vaultType = (lpToken.type || 'POOL').toUpperCase();

        // Validate tokens based on vault type
        if ((vaultType === 'POOL' || vaultType === 'SUBLINK') && (!tokenA || !tokenB)) {
            return NextResponse.json({
                status: 'error',
                message: `For ${vaultType} type vaults, both tokenA and tokenB are required.`
            }, { status: 400 });
        }

        // Construct vault object
        console.log('API: Building vault from token data');
        const [contractAddress, contractName] = contractId.split('.');

        if (!contractAddress || !contractName) {
            return NextResponse.json({ status: 'error', message: 'Invalid contractId format derived from URL path.' }, { status: 400 });
        }

        // Convert lpRebatePercent to fee if available
        let fee = 0;
        if (typeof lpToken.lpRebatePercent === 'number') {
            fee = Math.floor((lpToken.lpRebatePercent / 100) * 1_000_000);
        }

        // Create the base vault object
        const vault: Vault = {
            type: vaultType,
            protocol: lpToken.protocol || 'CHARISMA',
            contractId,
            contractAddress,
            contractName,
            name: lpToken.name,
            symbol: lpToken.symbol,
            decimals: lpToken.decimals,
            identifier: lpToken.identifier || '',
            description: lpToken.description || "",
            image: lpToken.image || "",
            fee,
            externalPoolId: lpToken.externalPoolId || "",
            engineContractId: lpToken.engineContractId || "",
        };

        // Add tokenA and tokenB if they exist
        if (tokenA) {
            vault.tokenA = tokenA;
            vault.reservesA = 0; // Initialize to 0
        }

        if (tokenB) {
            vault.tokenB = tokenB;
            vault.reservesB = 0; // Initialize to 0
        }

        // For SUBLINK type, add the tokenBContract field if needed
        if (vaultType === 'SUBLINK' && tokenB) {
            vault.tokenBContract = tokenB.contractId;
        }

        // Add any additional data fields if provided
        if (additionalData) {
            vault.additionalData = additionalData;
        }

        // Log vault data for debugging
        console.log('API: Vault data to save:', {
            contractId: vault.contractId,
            type: vault.type,
            protocol: vault.protocol,
            name: vault.name,
            symbol: vault.symbol,
            tokenA: vault.tokenA ? { name: vault.tokenA.name, symbol: vault.tokenA.symbol } : 'Not provided',
            tokenB: vault.tokenB ? { name: vault.tokenB.name, symbol: vault.tokenB.symbol } : 'Not provided',
        });

        // Save vault data using the service function
        console.log(`API: Saving vault to KV...`);
        const saved = await saveVaultData(vault);
        if (!saved) {
            console.error(`API: Failed to save vault data for ${contractId} via saveVaultData.`);
            return NextResponse.json({ status: 'error', message: 'Failed to save vault data in KV.' }, { status: 500 });
        }

        // Revalidate page(s) where the vault list is displayed
        revalidatePath('/');
        revalidatePath('/listing'); // Revalidate the listing page itself
        revalidatePath('/pools');    // Revalidate pools page
        revalidatePath('/sublinks'); // Revalidate sublinks page

        console.log(`API: Vault ${contractId} (type: ${vaultType}) confirmed and saved successfully.`);
        // Return the saved vault data
        return NextResponse.json({ status: 'success', vault });

    } catch (error: any) {
        console.error(`API Error confirming vault:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        return NextResponse.json({ status: 'error', message: `Failed to confirm vault: ${errorMessage}` }, { status: 500 });
    }
}

// Wrap the handler with admin authentication
export const POST = withAdminAuth(confirmVaultHandler);