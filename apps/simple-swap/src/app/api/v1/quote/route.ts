import { NextRequest, NextResponse } from 'next/server';
import { getQuote } from '../../../actions';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS(request: NextRequest) {
    // Handle preflight requests
    return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;

    const tokenIn = searchParams.get('tokenIn');
    const tokenOut = searchParams.get('tokenOut');
    const amount = searchParams.get('amount');

    // --- Basic Validation ---
    if (!tokenIn) {
        return NextResponse.json({ success: false, error: 'Missing tokenIn parameter' }, { status: 400 });
    }
    if (!tokenOut) {
        return NextResponse.json({ success: false, error: 'Missing tokenOut parameter' }, { status: 400 });
    }
    if (!amount) {
        return NextResponse.json({ success: false, error: 'Missing amount parameter' }, { status: 400 });
    }
    // Validate amount is a positive integer string
    if (!/^\d+$/.test(amount) || BigInt(amount) <= 0) {
        return NextResponse.json({ success: false, error: 'Invalid amount parameter. Must be a positive integer.' }, { status: 400 });
    }
    // --- End Validation ---

    try {
        // Call the existing server action logic
        const result = await getQuote(tokenIn, tokenOut, amount);

        if (result.success && result.data) {
            return NextResponse.json(
                { success: true, data: result.data },
                {
                    status: 200,
                    headers: {
                        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59'
                    }
                }
            );
        } else {
            // Use the error message from getQuote if available
            return NextResponse.json({ success: false, error: result.error || 'Failed to get quote' }, { status: 500 });
        }
    } catch (e) {
        console.error("API /v1/quote Error:", e);
        const errorMessage = e instanceof Error ? e.message : 'Internal server error';
        // General catch block for unexpected errors in the action itself
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
} 