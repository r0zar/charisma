import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import type { LimitOrder } from '@/lib/orders/types';

interface TransactionStats {
    totalMonitored: number;
    pendingTransactions: number;
    confirmedTransactions: number;
    failedTransactions: number;
    lastCheckTime?: string;
    processingHealth: 'healthy' | 'warning' | 'error';
}

export async function GET() {
    try {
        // Get all orders from KV store
        const ordersData = await kv.hgetall('orders');
        
        if (!ordersData) {
            return NextResponse.json({
                status: 'success',
                data: {
                    totalMonitored: 0,
                    pendingTransactions: 0,
                    confirmedTransactions: 0,
                    failedTransactions: 0,
                    processingHealth: 'healthy'
                } as TransactionStats
            });
        }
        
        const orders = Object.entries(ordersData).map(([id, orderJson]) => ({
            id,
            order: JSON.parse(orderJson as string) as LimitOrder
        }));
        
        // Count orders by their status and transaction presence
        let pendingTransactions = 0;
        let confirmedTransactions = 0;
        let failedTransactions = 0;
        
        for (const { order } of orders) {
            if (order.txid) {
                switch (order.status) {
                    case 'broadcasted':
                    case 'filled': // Legacy status - treat as broadcasted
                        pendingTransactions++;
                        break;
                    case 'confirmed':
                        confirmedTransactions++;
                        break;
                    case 'failed':
                        failedTransactions++;
                        break;
                    default:
                        // Other statuses (open, cancelled) don't count for transaction monitoring
                        break;
                }
            }
        }
        
        const totalMonitored = pendingTransactions + confirmedTransactions + failedTransactions;
        
        // Determine processing health
        let processingHealth: TransactionStats['processingHealth'] = 'healthy';
        if (failedTransactions > totalMonitored * 0.1) { // More than 10% failed
            processingHealth = 'error';
        } else if (pendingTransactions > totalMonitored * 0.3) { // More than 30% pending
            processingHealth = 'warning';
        }
        
        // Get last check time from monitoring cron
        const lastCheckTime = await kv.get('monitoring:last_check');
        
        const stats: TransactionStats = {
            totalMonitored,
            pendingTransactions,
            confirmedTransactions,
            failedTransactions,
            lastCheckTime: lastCheckTime as string || undefined,
            processingHealth
        };
        
        return NextResponse.json({
            status: 'success',
            data: stats
        });
        
    } catch (error) {
        console.error('Failed to fetch transaction stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch transaction stats' },
            { status: 500 }
        );
    }
}