import { NextRequest, NextResponse } from 'next/server';
import { realTimeCheck } from '@/lib/transaction-monitor';
import { getTransactionCacheHeaders, checkConditionalHeaders } from '@/lib/http-cache';

/**
 * Get real-time transaction status
 * GET /api/v1/status/[txid]
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ txid: string }> }
) {
    try {
        const { txid } = await params;
        
        if (!txid) {
            return NextResponse.json({
                success: false,
                error: 'Transaction ID is required'
            }, { status: 400 });
        }
        
        if (typeof txid !== 'string' || !txid.trim()) {
            return NextResponse.json({
                success: false,
                error: 'Invalid transaction ID'
            }, { status: 400 });
        }
        
        // Basic validation for transaction ID format
        // Stacks transaction IDs should be 64 characters and start with 0x
        if (txid.length < 10 || (!txid.startsWith('0x') && txid.length !== 64)) {
            return NextResponse.json({
                success: false,
                error: 'Transaction not found',
                message: 'Invalid transaction ID format'
            }, { status: 404 });
        }
        
        console.log(`[TX-MONITOR-API] Real-time status check for: ${txid}`);
        
        const result = await realTimeCheck(txid);
        
        // Generate appropriate cache headers based on transaction status
        const cacheHeaders = getTransactionCacheHeaders(result.status, result.fromCache);
        
        // Check conditional headers for confirmed transactions
        if (result.status !== 'pending') {
            const etag = cacheHeaders['ETag'];
            if (etag && checkConditionalHeaders(request, etag)) {
                return new NextResponse(null, { 
                    status: 304,
                    headers: cacheHeaders
                });
            }
        }
        
        return NextResponse.json({
            success: true,
            data: result
        }, { 
            headers: cacheHeaders
        });
        
    } catch (error) {
        console.error('[TX-MONITOR-API] Error in real-time status check:', error);
        
        // Check if this is a "not found" error and return 404
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('not found on blockchain')) {
            return NextResponse.json({
                success: false,
                error: 'Transaction not found',
                message: 'Transaction ID not found on blockchain'
            }, { status: 404 });
        }
        
        return NextResponse.json({
            success: false,
            error: 'Failed to check transaction status',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}