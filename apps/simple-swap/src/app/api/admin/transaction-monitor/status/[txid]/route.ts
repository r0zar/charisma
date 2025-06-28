import { NextRequest, NextResponse } from 'next/server';
import { checkTransactionStatus } from '@/lib/transaction-monitor';
import { kv } from '@vercel/kv';

/**
 * Get cached transaction status for a specific transaction
 * GET /api/admin/transaction-monitor/status/[txid]
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { txid: string } }
) {
    try {
        const { txid } = await params;

        if (!txid) {
            return NextResponse.json({
                success: false,
                error: 'Transaction ID is required'
            }, { status: 400 });
        }

        console.log(`[TX-STATUS-API] Checking status for transaction: ${txid}`);

        // Get cached transaction status
        const statusResult = await checkTransactionStatus(txid);
        const status = statusResult.status;

        if (!status) {
            return NextResponse.json({
                success: false,
                error: 'Transaction status not found',
                message: 'Transaction has not been checked yet or does not exist'
            }, { status: 404 });
        }

        // Get additional metadata based on status
        let additionalData = {};

        if (status === 'success') {
            try {
                const confirmedData = await kv.get(`tx:confirmed:${txid}`);
                if (confirmedData) {
                    additionalData = JSON.parse(confirmedData as string);
                }
            } catch (error) {
                console.warn(`[TX-STATUS-API] Could not parse confirmed data for ${txid}:`, error);
            }
        } else if (status === 'abort_by_response' || status === 'abort_by_post_condition') {
            try {
                const failedData = await kv.get(`tx:failed:${txid}`);
                if (failedData) {
                    additionalData = JSON.parse(failedData as string);
                }
            } catch (error) {
                console.warn(`[TX-STATUS-API] Could not parse failed data for ${txid}:`, error);
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                txid,
                status,
                checkedAt: new Date().toISOString(),
                ...additionalData
            }
        });

    } catch (error) {
        console.error('[TX-STATUS-API] Error getting transaction status:', error);

        return NextResponse.json({
            success: false,
            error: 'Failed to get transaction status',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}