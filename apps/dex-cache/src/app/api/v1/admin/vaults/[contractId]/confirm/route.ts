import { type NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { saveVaultData, VAULT_LIST_KEY } from "@/lib/vaultService";
import { kv } from '@vercel/kv';
import { revalidatePath } from 'next/cache';

// Define the expected structure for vault data (adjust based on actual Token interface if available)
interface TokenData {
    contractId: string;
    name: string;
    symbol: string;
    decimals: number;
    identifier?: string;
    description?: string;
    image?: string;
    contract_principal?: string;
    // Add any other relevant fields from your Token type
}

// Updated RequestBody: contractId is now from URL params
interface RequestBody {
    lpToken: TokenData & { lpRebatePercent?: number, externalPoolId?: string, engineContractId?: string };
    tokenA: TokenData;
    tokenB: TokenData;
}

// Define the structure for the final Vault object (adjust as needed)
interface Vault {
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
    tokenA: TokenData;
    tokenB: TokenData;
    reservesA: number; // Initial reserves likely 0 when confirming
    reservesB: number; // Initial reserves likely 0 when confirming
}

// Updated handler signature to accept params
async function confirmVaultHandler(req: NextRequest, { params }: { params: { contractId: string } }) {
    try {
        // Get contractId from URL parameters
        const contractId = params.contractId;
        // Get other data from request body
        const { lpToken, tokenA, tokenB } = (await req.json()) as RequestBody;

        console.log(`API: Confirming vault (dynamic route): ${contractId}`);

        // Validation: check contractId from params and data from body
        if (!contractId || !contractId.includes('.')) {
            return NextResponse.json({ status: 'error', message: 'Invalid contractId in URL path.' }, { status: 400 });
        }
        if (!lpToken || !tokenA || !tokenB) {
            return NextResponse.json({ status: 'error', message: 'Missing required data (lpToken, tokenA, tokenB) in request body.' }, { status: 400 });
        }

        // Construct vault object (logic adapted from confirmVault Server Action)
        console.log('API: Building vault manually from token data');
        const [contractAddress, contractName] = contractId.split('.');

        if (!contractAddress || !contractName) {
            // This check is somewhat redundant given the contractId format check above, but safe to keep
            return NextResponse.json({ status: 'error', message: 'Invalid contractId format derived from URL path.' }, { status: 400 });
        }

        const vault: Vault = {
            contractId, // Use contractId from params
            contractAddress,
            contractName,
            name: lpToken.name,
            symbol: lpToken.symbol,
            decimals: lpToken.decimals,
            identifier: lpToken.identifier || '',
            description: lpToken.description || "",
            image: lpToken.image || "",
            // Calculate fee: handle potential non-numeric or missing lpRebatePercent
            fee: typeof lpToken.lpRebatePercent === 'number' ? Math.floor((lpToken.lpRebatePercent / 100) * 1_000_000) : 0,
            externalPoolId: lpToken.externalPoolId || "",
            engineContractId: lpToken.engineContractId || "",
            tokenA,
            tokenB,
            // Assuming reserves are not known/set at confirmation time via this route
            reservesA: 0,
            reservesB: 0
        };

        // Log vault data for debugging
        console.log('API: Vault data to save:', {
            contractId: vault.contractId,
            name: vault.name,
            symbol: vault.symbol,
            tokenA: { name: vault.tokenA?.name, symbol: vault.tokenA?.symbol },
            tokenB: { name: vault.tokenB?.name, symbol: vault.tokenB?.symbol },
        });

        // Save vault data using the service function
        console.log(`API: Saving vault to KV...`);
        const saved = await saveVaultData(vault);
        if (!saved) {
            console.error(`API: Failed to save vault data for ${contractId} via saveVaultData.`);
            return NextResponse.json({ status: 'error', message: 'Failed to save vault data in KV.' }, { status: 500 });
        }

        // Add to managed list (optional, might be handled elsewhere)
        // ... (optional list management logic) ...

        // Revalidate page(s) where the vault list is displayed
        revalidatePath('/');
        revalidatePath('/listing'); // Revalidate the listing page itself

        console.log(`API: Vault ${contractId} confirmed and saved successfully.`);
        // Return the saved vault data (or just success status)
        return NextResponse.json({ status: 'success', vault });

    } catch (error: any) {
        console.error(`API Error confirming vault:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        return NextResponse.json({ status: 'error', message: `Failed to confirm vault: ${errorMessage}` }, { status: 500 });
    }
}

// Wrap the handler with admin authentication
export const POST = withAdminAuth(confirmVaultHandler); 