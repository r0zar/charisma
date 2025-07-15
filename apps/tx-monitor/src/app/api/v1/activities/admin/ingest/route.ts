/**
 * Admin Activity Management API endpoint
 * POST /api/v1/activities/admin/ingest - Manually trigger activity operations
 * GET /api/v1/activities/admin/ingest - Get activity statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivityStats } from '@/lib/activity-storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...options } = body;
    
    // For now, we'll just log the admin actions since activities are created automatically
    // In the future, we could add manual sync/cleanup operations here
    
    switch (action) {
      case 'full':
        console.log('[TX-MONITOR] Admin triggered full sync (not implemented)');
        return NextResponse.json({
          success: true,
          message: 'Full sync triggered (activities are created automatically)',
          data: { processed: 0, skipped: 0 }
        });
        
      case 'incremental':
        console.log('[TX-MONITOR] Admin triggered incremental sync (not implemented)');
        return NextResponse.json({
          success: true,
          message: 'Incremental sync triggered (activities are created automatically)',
          data: { processed: 0, skipped: 0 }
        });
        
      case 'cleanup':
        console.log('[TX-MONITOR] Admin triggered cleanup (not implemented)');
        return NextResponse.json({
          success: true,
          message: 'Cleanup triggered (not implemented)',
          data: { deletedCount: 0 }
        });
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: full, incremental, or cleanup' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('[TX-MONITOR] Error in admin operation:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process admin request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get activity stats
    const stats = await getActivityStats();
    
    return NextResponse.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('[TX-MONITOR] Error getting activity stats:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get activity stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}