import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to get raw TwitterTriggerExecution records with all fields
 */
export async function GET(request: NextRequest) {
    try {
        // Only allow in development environment
        if (process.env.NODE_ENV !== 'development') {
            return NextResponse.json({ error: 'Debug endpoint only available in development' }, { status: 403 });
        }

        console.log('[Debug] Fetching raw TwitterTriggerExecution records...');
        
        const { kv } = await import('@vercel/kv');
        
        // Get all TwitterTriggerExecution records
        const executionKeys = await kv.keys('twitter_execution:*');
        console.log(`[Debug] Found ${executionKeys.length} execution keys`);
        
        const executions = [];
        for (const key of executionKeys) {
            try {
                const execution = await kv.get(key);
                if (execution) {
                    executions.push({
                        key,
                        ...execution // Spread all fields from the raw record
                    });
                }
            } catch (error) {
                console.warn(`[Debug] Failed to fetch execution for key ${key}:`, error);
            }
        }
        
        // Analyze what fields are available
        const fieldAnalysis = {};
        const sampleExecution = executions[0];
        
        if (sampleExecution) {
            Object.keys(sampleExecution).forEach(field => {
                const valuesWithField = executions.filter(exec => exec[field] !== undefined && exec[field] !== null);
                fieldAnalysis[field] = {
                    totalRecords: executions.length,
                    recordsWithField: valuesWithField.length,
                    percentage: Math.round((valuesWithField.length / executions.length) * 100),
                    sampleValue: valuesWithField[0]?.[field]
                };
            });
        }
        
        // Find records that might be missing key fields
        const missingFieldsAnalysis = executions.map(exec => ({
            id: exec.id,
            replierHandle: exec.replierHandle,
            hasReplyText: !!exec.replyText,
            hasReplyTweetId: !!exec.replyTweetId,
            hasReplierDisplayName: !!exec.replierDisplayName,
            hasReplyCreatedAt: !!exec.replyCreatedAt,
            hasTxid: !!exec.txid,
            status: exec.status,
            orderUuid: exec.orderUuid
        }));
        
        const summary = {
            totalExecutions: executions.length,
            fieldsAnalysis: fieldAnalysis,
            recordsMissingReplyText: missingFieldsAnalysis.filter(r => !r.hasReplyText).length,
            recordsMissingReplyTweetId: missingFieldsAnalysis.filter(r => !r.hasReplyTweetId).length,
            recordsMissingDisplayName: missingFieldsAnalysis.filter(r => !r.hasReplierDisplayName).length,
            recordsMissingCreatedAt: missingFieldsAnalysis.filter(r => !r.hasReplyCreatedAt).length
        };
        
        console.log('[Debug] Raw executions analysis:', summary);
        
        return NextResponse.json({
            success: true,
            summary,
            executions: executions.slice(0, 5), // Return first 5 for inspection
            missingFieldsAnalysis,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[Debug] Error analyzing raw executions:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}