import { NextRequest, NextResponse } from 'next/server';
import { getTransactionMonitoringStats } from '@/lib/transaction-monitor';

/**
 * Admin endpoint to get transaction monitoring statistics
 * GET /api/admin/transaction-monitor/stats
 */
export async function GET(request: NextRequest) {
    try {
        console.log('[TX-MONITOR-STATS] Fetching transaction monitoring statistics...');

        const stats = await getTransactionMonitoringStats();

        console.log('[TX-MONITOR-STATS] Statistics retrieved:', stats);

        // Ensure all values are numbers and not undefined/null
        const safeStats = {
            totalOrders: stats.totalOrders || 0,
            ordersNeedingMonitoring: stats.ordersNeedingMonitoring || 0,
            pendingTransactions: stats.pendingTransactions || 0,
            confirmedTransactions: stats.confirmedTransactions || 0,
            failedTransactions: stats.failedTransactions || 0,
            orderTypes: {
                single: stats.orderTypes?.single || 0,
                dca: stats.orderTypes?.dca || 0,
                sandwich: stats.orderTypes?.sandwich || 0
            }
        };

        return NextResponse.json({
            success: true,
            data: safeStats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[TX-MONITOR-STATS] Error fetching statistics:', error);
        console.error('[TX-MONITOR-STATS] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

        return NextResponse.json({
            success: false,
            error: 'Failed to fetch transaction monitoring statistics',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}