import { NextRequest, NextResponse } from 'next/server';
import { getTransactionMonitoringStats } from '@/lib/transaction-monitor';
import { TxMonitorClient } from '@repo/tx-monitor-client';

// Initialize tx-monitor client
const txMonitorClient = new TxMonitorClient();

/**
 * Admin endpoint to get transaction monitoring statistics
 * GET /api/admin/transaction-monitor/stats
 */
export async function GET(request: NextRequest) {
    try {
        console.log('[TX-MONITOR-STATS] Fetching transaction monitoring statistics...');

        // Get both local stats and tx-monitor-client stats
        const [localStats, txMonitorStats, txMonitorHealth] = await Promise.all([
            getTransactionMonitoringStats(),
            txMonitorClient.getQueueStats().catch(() => null),
            txMonitorClient.getHealthCheck().catch(() => null)
        ]);

        console.log('[TX-MONITOR-STATS] Local statistics retrieved:', localStats);
        console.log('[TX-MONITOR-STATS] TX-Monitor statistics retrieved:', txMonitorStats);
        console.log('[TX-MONITOR-STATS] TX-Monitor health retrieved:', txMonitorHealth);

        // Ensure all values are numbers and not undefined/null
        const safeStats = {
            totalOrders: localStats.totalOrders || 0,
            ordersNeedingMonitoring: localStats.ordersNeedingMonitoring || 0,
            pendingTransactions: localStats.pendingTransactions || 0,
            confirmedTransactions: localStats.confirmedTransactions || 0,
            failedTransactions: localStats.failedTransactions || 0,
            processingHealth: localStats.processingHealth || 'error',
            lastCheckTime: localStats.lastCheckTime,
            orderTypes: {
                single: localStats.orderTypes?.single || 0,
                dca: localStats.orderTypes?.dca || 0,
                sandwich: localStats.orderTypes?.sandwich || 0
            },
            // Add tx-monitor-client specific stats
            txMonitor: {
                queueSize: txMonitorStats?.queueSize || 0,
                oldestTransaction: txMonitorStats?.oldestTransaction,
                oldestTransactionAge: txMonitorStats?.oldestTransactionAge,
                totalProcessed: txMonitorStats?.totalProcessed || 0,
                totalFailed: txMonitorStats?.totalFailed || 0,
                totalSuccessful: txMonitorStats?.totalSuccessful || 0,
                processingHealth: txMonitorStats?.processingHealth || 'error',
                serviceHealth: txMonitorHealth ? {
                    cron: txMonitorHealth.cron,
                    api: txMonitorHealth.api,
                    queue: txMonitorHealth.queue,
                    kvConnectivity: txMonitorHealth.kvConnectivity,
                    uptime: txMonitorHealth.uptime
                } : null
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