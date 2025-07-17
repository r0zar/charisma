/**
 * Manual Price Update Trigger
 * 
 * Allows manual triggering of price updates for testing and debugging.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // Import the cron handler
        const { GET } = await import('../cron/route');
        
        console.log('[ManualTrigger] Manually triggered price update');
        
        // Create a mock request to pass to the cron handler
        const mockRequest = new Request(request.url.replace('/trigger', '/cron'), {
            method: 'GET',
            headers: request.headers
        });
        
        const result = await GET(mockRequest as NextRequest);
        const data = await result.json();
        
        return NextResponse.json({
            triggered: true,
            result: data
        });
        
    } catch (error) {
        console.error('[ManualTrigger] Error:', error);
        return NextResponse.json({
            triggered: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}