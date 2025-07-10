import { NextRequest, NextResponse } from 'next/server';
import { appState } from '@/data/app-state';
import { botDataStore, isKVAvailable } from '@/lib/infrastructure/storage';
import { getLoadingConfig } from '@/lib/infrastructure/config/loading';

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
    const useDefault = searchParams.get('default') === 'true';
    const section = searchParams.get('section') as 'list' | 'stats' | null;
    const status = searchParams.get('status');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Check if we should use KV store or static data
    const loadingConfig = getLoadingConfig();
    const useKV = loadingConfig.bots === 'api' && !useDefault;
    let responseData;

    if (useKV) {
      // Use KV store for bot data
      const kvAvailable = await isKVAvailable();
      if (!kvAvailable) {
        return NextResponse.json(
          {
            error: 'KV store unavailable',
            message: 'Bot data storage is temporarily unavailable',
            timestamp: new Date().toISOString(),
          },
          { status: 503 }
        );
      }

      console.log('🌍 Public bot data request (all users)');

      try {
        // Get all public bots
        let allBots = await botDataStore.getAllBotsPublic();
        
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
        const stats = await botDataStore.getPublicBotStats();

        responseData = {
          list: paginatedBots,
          stats,
          pagination: {
            total: totalBots,
            offset,
            limit: limit || totalBots,
            hasMore: limit ? (offset + limit) < totalBots : false
          }
        };

        console.log(`📊 Returned ${paginatedBots.length} of ${totalBots} public bots`);

      } catch (kvError) {
        console.error('KV store error:', kvError);
        return NextResponse.json(
          {
            error: 'Failed to fetch bot data',
            message: 'Unable to retrieve bot information from storage',
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        );
      }
    } else {
      // Use static data as fallback
      console.log('📄 Using static data for public bots');
      
      let allBots = appState.bots.list;
      
      // Filter by status if specified
      if (status) {
        allBots = allBots.filter(bot => bot.status === status);
      }

      // Apply pagination
      const totalBots = allBots.length;
      const paginatedBots = limit 
        ? allBots.slice(offset, offset + limit)
        : allBots.slice(offset);

      responseData = {
        list: paginatedBots,
        stats: {
          ...appState.bots.stats,
          totalUsers: new Set(appState.bots.list.map(bot => bot.ownerId)).size
        },
        pagination: {
          total: totalBots,
          offset,
          limit: limit || totalBots,
          hasMore: limit ? (offset + limit) < totalBots : false
        }
      };
    }

    // Return specific section if requested
    if (section === 'list') {
      return NextResponse.json({
        list: responseData.list,
        pagination: responseData.pagination
      });
    }
    
    if (section === 'stats') {
      return NextResponse.json({
        stats: responseData.stats
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