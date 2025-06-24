import { NextRequest, NextResponse } from 'next/server';
import { syncTwitterExecutionsWithOrders } from '@/lib/twitter-triggers/store';

// POST /api/admin/twitter-triggers/sync-executions - Sync Twitter execution statuses with order statuses
export async function POST(request: NextRequest) {
    try {
        console.log('[Admin API] Starting Twitter execution sync...');
        
        const result = await syncTwitterExecutionsWithOrders();
        
        const response = {
            success: true,
            message: 'Twitter execution sync completed',
            data: result
        };
        
        console.log('[Admin API] Twitter execution sync completed:', result);
        
        return NextResponse.json(response);
        
    } catch (error) {
        console.error('[Admin API] Error during Twitter execution sync:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Twitter execution sync failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}