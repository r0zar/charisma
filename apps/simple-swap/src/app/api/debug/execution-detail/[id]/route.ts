import { NextRequest, NextResponse } from 'next/server';

/**
 * Get detailed information about a specific TwitterTriggerExecution
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // Only allow in development environment
        if (process.env.NODE_ENV !== 'development') {
            return NextResponse.json({ error: 'Debug endpoint only available in development' }, { status: 403 });
        }

        const executionId = params.id;
        console.log(`[Debug] Fetching execution details for: ${executionId}`);
        
        const { kv } = await import('@vercel/kv');
        
        // Get the specific execution
        const execution = await kv.get(`twitter_execution:${executionId}`);
        
        if (!execution) {
            return NextResponse.json({
                success: false,
                error: `Execution ${executionId} not found`
            }, { status: 404 });
        }
        
        // Analyze what fields are present
        const fieldsPresent = Object.keys(execution).map(field => ({
            field,
            hasValue: execution[field] !== undefined && execution[field] !== null && execution[field] !== '',
            value: execution[field],
            type: typeof execution[field]
        }));
        
        return NextResponse.json({
            success: true,
            executionId,
            execution,
            fieldsPresent,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`[Debug] Error fetching execution ${params.id}:`, error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}