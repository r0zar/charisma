/**
 * Activity Statistics API endpoint
 * GET /api/v1/activities/stats - Get activity statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivityStats } from '@/lib/activity-storage';

export async function GET(request: NextRequest) {
  try {
    const stats = await getActivityStats();
    
    console.log(`[TX-MONITOR] Activity stats: ${stats.total} total activities`);
    
    return NextResponse.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('[TX-MONITOR] Error getting activity stats:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get activity statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}