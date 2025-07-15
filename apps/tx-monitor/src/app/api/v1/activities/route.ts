/**
 * Activities API endpoint in tx-monitor
 * GET /api/v1/activities - Get activity timeline with pagination and filtering
 * Provides activities to simple-swap for display
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivityTimeline, getUserActivityTimeline, getActivityStats } from '@/lib/activity-storage';
import { ActivityFeedOptions, ActivityType, ActivityStatus } from '@/lib/activity-types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100); // Max 100 per page
    const sortBy = searchParams.get('sortBy') || 'timestamp';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const owner = searchParams.get('owner');
    const types = searchParams.get('types')?.split(',') as ActivityType[] | undefined;
    const statuses = searchParams.get('statuses')?.split(',') as ActivityStatus[] | undefined;
    const searchQuery = searchParams.get('search');
    
    // Date range filtering
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const dateRange = startDate && endDate ? {
      start: parseInt(startDate, 10),
      end: parseInt(endDate, 10)
    } : undefined;
    
    // Build options
    const options: ActivityFeedOptions = {
      limit,
      offset,
      sortBy,
      sortOrder,
      owner,
      types,
      statuses,
      searchQuery,
      dateRange
    };
    
    // Get activities
    const result = owner 
      ? await getUserActivityTimeline(owner, options)
      : await getActivityTimeline(options);
    
    console.log(`[TX-MONITOR] Activities API: returned ${result.activities.length} activities`);
    
    return NextResponse.json({
      success: true,
      data: result.activities,
      pagination: {
        page,
        limit,
        total: result.total,
        hasMore: result.hasMore
      }
    });
    
  } catch (error) {
    console.error('[TX-MONITOR] Error in activities API:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch activities',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // This endpoint could be used for creating activities manually if needed
    const body = await request.json();
    
    // For now, just return method not allowed
    return NextResponse.json({
      success: false,
      error: 'Activity creation via API not supported yet'
    }, { status: 405 });
    
  } catch (error) {
    console.error('[TX-MONITOR] Error in activities POST:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}