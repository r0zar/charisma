/**
 * Admin Activity Ingestion API endpoint
 * POST /api/v1/activity/admin/ingest - Manually trigger activity ingestion
 */

import { NextRequest, NextResponse } from 'next/server';
import { runFullIngestion, runIncrementalIngestion, cleanupOldActivities } from '@/lib/activity/ingestion';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...options } = body;
    
    switch (action) {
      case 'full':
        console.log('Starting full ingestion...');
        const fullResult = await runFullIngestion();
        
        return NextResponse.json({
          success: true,
          message: 'Full ingestion completed',
          data: fullResult
        });
        
      case 'incremental':
        console.log('Starting incremental ingestion...');
        const incrementalResult = await runIncrementalIngestion(options.lastSyncTimestamp);
        
        return NextResponse.json({
          success: true,
          message: 'Incremental ingestion completed',
          data: incrementalResult
        });
        
      case 'cleanup':
        console.log('Starting cleanup...');
        const cleanupResult = await cleanupOldActivities(options.olderThanDays || 90);
        
        return NextResponse.json({
          success: true,
          message: 'Cleanup completed',
          data: { deletedCount: cleanupResult }
        });
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: full, incremental, or cleanup' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('Error in admin ingestion:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process ingestion request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get ingestion status/stats
    const { getActivityStats } = await import('@/lib/activity/storage');
    const stats = await getActivityStats();
    
    return NextResponse.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Error getting ingestion stats:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get ingestion stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}