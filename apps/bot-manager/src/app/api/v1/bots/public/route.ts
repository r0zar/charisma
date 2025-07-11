import { NextRequest, NextResponse } from 'next/server';

import { botService } from '@/lib/services/bots/service';

/**
 * GET /api/v1/bots/public
 * Returns all bots from all users (public view)
 * Query params:
 * - default: 'true' to use default state (ignores KV)
 * - section: 'list' | 'stats' to get specific section
 * - status: filter bots by status (active, paused, error, setup)
 * - limit: limit number of results
 * - offset: offset for pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get('section') as 'list' | 'stats' | null;
    const status = searchParams.get('status');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    console.log(`🌍 Public bot data request (${botService.getDataSource()})`);

    let responseData;

    // Get all public bots
    let allBots = await botService.getPublicBots();
    
    // Filter by status if specified
    if (status) {
      allBots = allBots.filter(bot => bot.status === status);
    }

    // Apply pagination
    const totalBots = allBots.length;
    const paginatedBots = limit 
      ? allBots.slice(offset, offset + limit)
      : allBots.slice(offset);

    // Get public stats
    const stats = await botService.getPublicBotStats();

    responseData = {
      list: paginatedBots,
      stats,
      pagination: {
        total: totalBots,
        offset,
        limit: limit || totalBots,
        hasMore: limit ? (offset + limit) < totalBots : false
      },
      source: botService.getDataSource(),
      timestamp: new Date().toISOString(),
    };

    console.log(`📊 Returned ${paginatedBots.length} of ${totalBots} public bots`);

    // Return specific section if requested
    if (section === 'list') {
      return NextResponse.json({
        list: responseData.list,
        pagination: responseData.pagination,
        source: responseData.source,
        timestamp: responseData.timestamp,
      });
    }
    
    if (section === 'stats') {
      return NextResponse.json({
        stats: responseData.stats,
        source: responseData.source,
        timestamp: responseData.timestamp,
      });
    }

    // Return full response
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Public bots API error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to process bot data request',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}