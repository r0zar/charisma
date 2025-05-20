import { broadcastTransaction, makeContractCall } from '@stacks/transactions';
import { type NextRequest, NextResponse } from 'next/server';

const CONTRACT_ADDRESS = "SPGYCP878RYFVT03ZT8TWGPKNYTSQB1578VVXHGE";
const CONTRACT_NAME = "powerful-farmer";
const FUNCTION_NAME = "execute-both";

/**
 * Cron job handler to call the execute-both function on the powerful-farmer contract
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
        console.log(`Minute Cron: Triggering ${CONTRACT_NAME}.${FUNCTION_NAME}...`);

        const transaction = await makeContractCall({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: FUNCTION_NAME,
            functionArgs: [],
            postConditionMode: 'allow',
            senderKey: signerKey,
        });

        const result = await broadcastTransaction({ transaction });

        // Success
        console.log(`Minute Cron: Successfully initiated TxID: ${result.txid}`);
        return NextResponse.json({ status: 'success', txId: result.txid });

    } catch (error: any) {
        console.error("Error during minute cron execution:", error);
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