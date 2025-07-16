/**
 * Portfolio profitability endpoint
 * GET /api/v1/activities/profitability/portfolio?owner={userAddress}&timeRange={range}
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculatePortfolioProfitability } from '@/lib/portfolio-profitability-service';
import { TimeRange } from '@/lib/profitability-types';

interface PortfolioResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    owner: string;
    timeRange: TimeRange;
    calculatedAt: string;
    positionsIncluded: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const owner = searchParams.get('owner');
    const timeRangeParam = searchParams.get('timeRange') || 'ALL';
    
    // Validate required parameters
    if (!owner) {
      return NextResponse.json({
        success: false,
        error: 'owner parameter is required'
      }, { status: 400 });
    }

    // Validate time range
    const validTimeRanges: TimeRange[] = ['1H', '24H', '7D', '30D', 'ALL'];
    const timeRange = validTimeRanges.includes(timeRangeParam as TimeRange) 
      ? timeRangeParam as TimeRange 
      : 'ALL';

    console.log(`[PORTFOLIO-API] Calculating portfolio P&L for owner: ${owner}, timeRange: ${timeRange}`);

    // Calculate portfolio profitability
    const portfolioData = await calculatePortfolioProfitability(owner, timeRange);

    if (!portfolioData) {
      return NextResponse.json({
        success: false,
        error: 'No portfolio data available or insufficient activity data',
        metadata: {
          owner,
          timeRange,
          calculatedAt: new Date().toISOString(),
          positionsIncluded: 0
        }
      }, { status: 404 });
    }

    const response: PortfolioResponse = {
      success: true,
      data: portfolioData,
      metadata: {
        owner,
        timeRange,
        calculatedAt: new Date().toISOString(),
        positionsIncluded: portfolioData.positions.length
      }
    };

    // Add caching headers for better performance
    const responseObj = NextResponse.json(response);
    responseObj.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600'); // Cache for 5 minutes
    
    console.log(`[PORTFOLIO-API] Successfully calculated portfolio for ${owner}: ${portfolioData.positions.length} positions, ${portfolioData.metrics.totalPnL.percentage.toFixed(2)}% total P&L`);

    return responseObj;

  } catch (error) {
    console.error('[PORTFOLIO-API] Error calculating portfolio profitability:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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