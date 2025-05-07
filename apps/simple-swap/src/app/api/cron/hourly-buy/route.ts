import { NextRequest, NextResponse } from 'next/server';
import { ensureVaultsLoaded } from '../../../actions'; // Reuse vault loading logic
import { Dexterity } from '@/lib/dexterity-client';

const CRON_SECRET = process.env.CRON_SECRET;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const HIRO_API_KEY = process.env.HIRO_API_KEY;

const TOKEN_IN = '.stx';
const TOKEN_OUT = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
const AMOUNT_IN = 1000000; // 1 STX in micro-STX

export async function GET(request: NextRequest) {
    // 1. Authorize the request
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check for Private Key Configuration
    if (!PRIVATE_KEY) {
        console.error('[Cron Job] PRIVATE_KEY environment variable is not set!');
        return NextResponse.json({ error: 'Server configuration error: Missing private key' }, { status: 500 });
    }

    console.log('[Cron Job] Hourly buy triggered.');

    try {
        // 3. Initialize Dexterity with the Cron Private Key
        // Ensure Dexterity uses the server's key for this execution context
        // Note: This might re-initialize Dexterity if called concurrently elsewhere.
        // Consider a more robust initialization pattern if needed.
        Dexterity.init({
            privateKey: PRIVATE_KEY,
            apiKey: HIRO_API_KEY, // Use API key for reads
            debug: false, // Enable debug logging for cron job
        });
        console.log('[Cron Job] Dexterity initialized with cron key.');

        // 4. Ensure Vaults are Loaded
        await ensureVaultsLoaded(); // Make sure routing data is available
        console.log('[Cron Job] Vaults loaded.');

        // 5. Execute the Swap
        console.log(`[Cron Job] Attempting to swap ${AMOUNT_IN} uSTX (${TOKEN_IN}) for ${TOKEN_OUT}...`);
        const result = await Dexterity.executeSwap(TOKEN_IN, TOKEN_OUT, AMOUNT_IN, { fee: 200 });

        console.log(result)
        return NextResponse.json(result);

    } catch (error) {
        console.error('[Cron Job] Unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown internal server error';
        return NextResponse.json({ success: false, error: `Unexpected error: ${errorMessage}` }, { status: 500 });
    }
} 