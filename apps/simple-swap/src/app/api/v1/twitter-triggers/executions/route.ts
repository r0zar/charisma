import { NextRequest, NextResponse } from 'next/server';
import { listAllTwitterExecutions } from '@/lib/twitter-triggers/store';

// GET /api/v1/twitter-triggers/executions - Get all Twitter trigger executions
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const triggerId = searchParams.get('triggerId');
        
        let executions;
        
        if (triggerId) {
            // Get executions for a specific trigger
            const { getTwitterExecutions } = await import('@/lib/twitter-triggers/store');
            executions = await getTwitterExecutions(triggerId, limit);
        } else {
            // Get all executions
            executions = await listAllTwitterExecutions(limit);
        }
        
        return NextResponse.json({
            success: true,
            data: executions,
            meta: {
                total: executions.length,
                limit,
                triggerId: triggerId || null,
            }
        });
        
    } catch (error) {
        console.error('[Twitter API] Error listing executions:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to list Twitter trigger executions'
        }, { status: 500 });
    }
}