import { type NextRequest, NextResponse } from 'next/server';
import { StacksClient } from '@repo/stacks'; // Import the custom client

const CONTRACT_ADDRESS = "SPGYCP878RYFVT03ZT8TWGPKNYTSQB1578VVXHGE";
const CONTRACT_NAME = "powerful-farmer";
const FUNCTION_NAME = "execute-both";
const CONTRACT_ID = `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`;

/**
 * Cron job handler to call the execute-both function on the powerful-farmer contract
 * using the StacksClient from @repo/stacks.
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const signerKey = process.env.PRIVATE_KEY;
    const networkEnv = process.env.NEXT_PUBLIC_NETWORK || 'mainnet';

    // --- Security Check ---
    if (!cronSecret) {
        console.error("CRON_SECRET environment variable is not set.");
        return NextResponse.json({ status: 'error', message: 'Server configuration error (missing cron secret).' }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn("Unauthorized cron job access attempt.");
        return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    // --- Environment Check ---
    if (!signerKey) {
        console.error("CRON_SIGNER_PRIVATE_KEY environment variable is not set.");
        return NextResponse.json({ status: 'error', message: 'Server configuration error (missing signer key).' }, { status: 500 });
    }

    // --- Transaction Logic ---
    try {
        console.log(`Minute Cron: Triggering ${CONTRACT_NAME}.${FUNCTION_NAME} via StacksClient...`);

        // Configure and get the StacksClient instance
        const stacksClient = StacksClient.getInstance({
            privateKey: signerKey,
            network: networkEnv === 'testnet' ? 'testnet' : 'mainnet',
            // Assuming default API base URL is sufficient, otherwise add baseUrl
            // baseUrl: networkEnv === 'testnet' ? 'https://api.testnet.hiro.so' : 'https://api.hiro.so',
            debug: process.env.NODE_ENV === 'development', // Optional debug logging
        });

        // Use the client to call the contract function
        // The client should handle nonce and broadcasting internally
        const txId = await stacksClient.callContractFunction(
            CONTRACT_ID,
            FUNCTION_NAME,
            [], // No arguments
            {} // No special options needed here unless specifying fee/nonce manually
        );

        // Success
        console.log(`Minute Cron: Successfully initiated TxID: ${txId}`);
        return NextResponse.json({ status: 'success', txId: txId });

    } catch (error: any) {
        console.error("Error during minute cron execution via StacksClient:", error);
        let errorMessage = 'An unknown error occurred';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        // Check if error has response data (common for API errors)
        if (error.response?.data) {
            errorMessage += ` - ${JSON.stringify(error.response.data)}`;
        }
        return NextResponse.json(
            { status: 'error', message: `Cron execution failed: ${errorMessage}` },
            { status: 500 }
        );
    }
} 