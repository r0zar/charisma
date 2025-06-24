import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to check TwitterTriggerExecution records
 */
export async function GET(request: NextRequest) {
    try {
        // Only allow in development environment
        if (process.env.NODE_ENV !== 'development') {
            return NextResponse.json({ error: 'Debug endpoint only available in development' }, { status: 403 });
        }

        console.log('[Debug] Fetching TwitterTriggerExecution records...');
        
        // Import the store functions
        const { kv } = await import('@vercel/kv');
        
        // Get all TwitterTriggerExecution records
        // Note: This assumes they're stored with a prefix pattern
        const executionKeys = await kv.keys('twitter_execution:*');
        console.log(`[Debug] Found ${executionKeys.length} execution keys`);
        
        const executions = [];
        for (const key of executionKeys) {
            try {
                const execution = await kv.get(key);
                if (execution) {
                    executions.push({
                        key,
                        data: execution
                    });
                }
            } catch (error) {
                console.warn(`[Debug] Failed to fetch execution for key ${key}:`, error);
            }
        }
        
        // Analyze the executions
        const analysis = executions.map(({ key, data }: any) => ({
            key,
            id: data.id,
            triggerId: data.triggerId,
            orderUuid: data.orderUuid,
            status: data.status,
            replierHandle: data.replierHandle,
            bnsName: data.bnsName,
            executedAt: data.executedAt,
            hasOrderUuid: !!data.orderUuid,
            txid: data.txid || null
        }));
        
        // Summary statistics
        const summary = {
            totalExecutions: executions.length,
            executionsWithOrderUuid: analysis.filter(a => a.hasOrderUuid).length,
            statusCounts: analysis.reduce((acc: any, curr) => {
                acc[curr.status] = (acc[curr.status] || 0) + 1;
                return acc;
            }, {}),
            uniqueTriggers: new Set(analysis.map(a => a.triggerId)).size
        };
        
        console.log('[Debug] Twitter executions analysis:', summary);
        
        return NextResponse.json({
            success: true,
            summary,
            executions: analysis,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[Debug] Error analyzing Twitter executions:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}