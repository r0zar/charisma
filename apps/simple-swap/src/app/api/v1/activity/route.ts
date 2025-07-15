/**
 * Activity Timeline API endpoint
 * GET /api/v1/activity - Get activity timeline with pagination and filtering
 * Follows existing API patterns from orders and swaps
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivityTimeline, getUserActivityTimeline } from '@/lib/activity/storage';
import { ActivityFeedOptions, ActivityType, ActivityStatus } from '@/lib/activity/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters (following existing API patterns)
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
    let dateRange: { start: number; end: number } | undefined;
    
    if (startDate && endDate) {
      dateRange = {
        start: new Date(startDate).getTime(),
        end: new Date(endDate).getTime()
      };
    }
    
    // Build options object
    const options: ActivityFeedOptions = {
      limit,
      offset,
      sortBy: sortBy as any,
      sortOrder,
      types,
      statuses,
      searchQuery,
      dateRange
    };
    
    // Get activity timeline
    let result;
    if (owner) {
      // Get user-specific timeline
      result = await getUserActivityTimeline(owner, options);
    } else {
      // Get global timeline
      result = await getActivityTimeline(options);
    }
    
    // Format response (following existing API response patterns)
    const response = {
      data: result.activities,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasMore: result.hasMore
      },
      filters: {
        owner,
        types,
        statuses,
        searchQuery,
        dateRange
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error fetching activity timeline:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch activity timeline',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // This could be used for triggering manual ingestion or other operations
    const body = await request.json();
    const { action } = body;
    
    if (action === 'sync') {
      // Trigger manual sync
      const { runIncrementalIngestion } = await import('@/lib/activity/ingestion');
      const result = await runIncrementalIngestion();
      
      return NextResponse.json({
        success: true,
        message: 'Sync completed',
        data: result
      });
    }
    
    if (action === 'fullSync') {
      // Trigger full sync (be careful with this in production)
      const { runFullIngestion } = await import('@/lib/activity/ingestion');
      const result = await runFullIngestion();
      
      return NextResponse.json({
        success: true,
        message: 'Full sync completed',
        data: result
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Error in activity POST:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}