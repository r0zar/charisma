/**
 * API endpoint for fetching trade profitability data
 * GET /api/v1/activities/{id}/profitability
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivity } from '@/lib/activity-storage';
import { calculateTradeProfitability, filterDataByTimeRange } from '@/lib/profitability-service';
import { TimeRange } from '@/lib/profitability-types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const timeRange = (searchParams.get('timeRange') as TimeRange) || 'ALL';

    // Get the activity
    const activity = await getActivity(id);
    if (!activity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      );
    }

    // Validate activity type and status
    if (activity.type !== 'instant_swap') {
      return NextResponse.json(
        { error: 'Profitability calculation only available for instant swaps' },
        { status: 422 }
      );
    }

    if (activity.status !== 'completed') {
      return NextResponse.json(
        { error: 'Profitability calculation only available for completed activities' },
        { status: 422 }
      );
    }

    // Calculate profitability
    const profitabilityData = await calculateTradeProfitability(activity);
    if (!profitabilityData) {
      return NextResponse.json(
        { 
          error: 'Profitability data not available for this activity',
          details: 'Check that the activity has valid token amounts and price data'
        },
        { status: 422 }
      );
    }

    // Filter chart data by time range if specified
    if (timeRange !== 'ALL') {
      profitabilityData.chartData = filterDataByTimeRange(
        profitabilityData.chartData,
        timeRange
      );
    }

    // Add cache headers for performance
    const response = NextResponse.json({
      success: true,
      data: profitabilityData,
      metadata: {
        activityId: id,
        timeRange,
        calculatedAt: new Date().toISOString()
      }
    });

    // Cache for 5 minutes for current data, longer for historical
    const cacheTime = timeRange === 'ALL' ? 300 : 60; // 5 minutes for all data, 1 minute for recent
    response.headers.set('Cache-Control', `public, s-maxage=${cacheTime}, stale-while-revalidate=86400`);

    return response;
  } catch (error) {
    console.error('Error calculating profitability:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}