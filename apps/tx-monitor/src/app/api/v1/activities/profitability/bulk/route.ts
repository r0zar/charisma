/**
 * Bulk profitability endpoint
 * POST /api/v1/activities/profitability/bulk
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivity } from '@/lib/activity-storage';
import { calculateTradeProfitability } from '@/lib/profitability-service';

interface BulkProfitabilityRequest {
  activityIds: string[];
  includeChartData?: boolean;
}

interface BulkProfitabilityResponse {
  success: boolean;
  data: Record<string, any>;
  metadata: {
    total: number;
    calculated: number;
    errors: number;
    timestamp: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkProfitabilityRequest = await request.json();
    const { activityIds, includeChartData = false } = body;

    if (!activityIds || !Array.isArray(activityIds)) {
      return NextResponse.json(
        { error: 'activityIds array is required' },
        { status: 400 }
      );
    }

    if (activityIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 activities allowed per request' },
        { status: 400 }
      );
    }

    const results: Record<string, any> = {};
    let calculated = 0;
    let errors = 0;

    // Process activities in parallel with limited concurrency
    const concurrency = 5;
    for (let i = 0; i < activityIds.length; i += concurrency) {
      const batch = activityIds.slice(i, i + concurrency);
      
      await Promise.allSettled(
        batch.map(async (activityId) => {
          try {
            const activity = await getActivity(activityId);
            if (!activity) {
              results[activityId] = { error: 'Activity not found' };
              errors++;
              return;
            }

            let profitabilityData = await calculateTradeProfitability(activity);
            if (!profitabilityData) {
              results[activityId] = { error: 'Profitability data not available' };
              errors++;
              return;
            }

            // Optionally exclude chart data for performance
            if (!includeChartData) {
              const { chartData, ...dataWithoutChart } = profitabilityData;
              results[activityId] = dataWithoutChart;
            } else {
              results[activityId] = profitabilityData;
            }
            calculated++;
          } catch (error) {
            console.error(`Error calculating profitability for ${activityId}:`, error);
            results[activityId] = { 
              error: error instanceof Error ? error.message : 'Calculation failed' 
            };
            errors++;
          }
        })
      );
    }

    const response: BulkProfitabilityResponse = {
      success: true,
      data: results,
      metadata: {
        total: activityIds.length,
        calculated,
        errors,
        timestamp: new Date().toISOString()
      }
    };

    // Add appropriate cache headers
    const responseObj = NextResponse.json(response);
    responseObj.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    return responseObj;
  } catch (error) {
    console.error('Error in bulk profitability calculation:', error);
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}