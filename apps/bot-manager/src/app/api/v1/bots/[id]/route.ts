import { NextRequest, NextResponse } from 'next/server';
import { appState } from '@/data/app-state';
import { defaultState } from '@/data/default-state';
import { botDataStore, isKVAvailable } from '@/lib/kv-store';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { config } from '@/lib/config';

/**
 * GET /api/v1/bots/[id]
 * Returns individual bot data
 * Query params:
 * - userId: user ID to get bot for (required for KV)
 * - default: 'true' to use default state (ignores KV)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const useDefault = searchParams.get('default') === 'true';
    const { id: botId } = await params;

    // Check if bot API is enabled
    if (!isFeatureEnabled('enableApiBots')) {
      return NextResponse.json(
        { 
          error: 'Bot API not enabled',
          message: 'Bot API feature is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // For multi-user KV store, userId is required
    if (!userId && !useDefault) {
      return NextResponse.json(
        { 
          error: 'Missing userId',
          message: 'userId parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    let bot = null;
    let source = 'static';

    // Check if we should use KV store
    const useKV = await isKVAvailable() && !useDefault;
    
    if (useKV && userId) {
      // Use KV store
      try {
        bot = await botDataStore.getBot(userId, botId);
        source = 'kv';
      } catch (error) {
        console.error(`[Bot API] Failed to fetch bot ${botId} from KV:`, error);
        // Don't return error here, fall back to static data
      }
    }
    
    // Fallback to static data if KV failed or not enabled
    if (!bot) {
      if (useDefault) {
        bot = defaultState.bots.list.find(b => b.id === botId);
        source = 'default';
      } else {
        bot = appState.bots.list.find(b => b.id === botId);
        source = 'static';
      }
    }

    if (!bot) {
      return NextResponse.json(
        { 
          error: 'Bot not found',
          message: `Bot with ID '${botId}' does not exist`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    const responseData = {
      bot,
      source,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': useKV ? 'private, s-maxage=10, stale-while-revalidate=60' : 'private, s-maxage=30, stale-while-revalidate=120',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching bot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch bot',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/bots/[id]
 * Update individual bot
 * Body: Partial bot data to update
 * Query params:
 * - userId: user ID (required for KV)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const { id: botId } = await params;
    const body = await request.json();

    // Check if bot API is enabled
    if (!isFeatureEnabled('enableApiBots')) {
      return NextResponse.json(
        { 
          error: 'Bot API not enabled',
          message: 'Bot API feature is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // For multi-user KV store, userId is required
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Missing userId',
          message: 'userId parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check if we should use KV store
    const useKV = await isKVAvailable();
    
    if (!useKV) {
      return NextResponse.json(
        { 
          error: 'KV store not available',
          message: 'Bot updates require KV store to be enabled and available',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Update bot in KV store
    const updatedBot = await botDataStore.updateBot(userId, botId, body);
    
    if (!updatedBot) {
      return NextResponse.json(
        { 
          error: 'Bot not found',
          message: `Bot with ID '${botId}' does not exist`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    const responseData = {
      bot: updatedBot,
      message: 'Bot updated successfully',
      source: 'kv',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': 'private, s-maxage=10, stale-while-revalidate=60',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error updating bot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update bot',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/bots/[id]
 * Delete individual bot
 * Query params:
 * - userId: user ID (required for KV)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const { id: botId } = await params;

    // Check if bot API is enabled
    if (!isFeatureEnabled('enableApiBots')) {
      return NextResponse.json(
        { 
          error: 'Bot API not enabled',
          message: 'Bot API feature is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // For multi-user KV store, userId is required
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Missing userId',
          message: 'userId parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check if we should use KV store
    const useKV = await isKVAvailable();
    
    if (!useKV) {
      return NextResponse.json(
        { 
          error: 'KV store not available',
          message: 'Bot deletion requires KV store to be enabled and available',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Delete bot from KV store
    const success = await botDataStore.deleteBot(userId, botId);
    
    if (!success) {
      return NextResponse.json(
        { 
          error: 'Bot not found',
          message: `Bot with ID '${botId}' does not exist`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    const responseData = {
      message: 'Bot deleted successfully',
      botId,
      source: 'kv',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': 'private, s-maxage=10, stale-while-revalidate=60',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error deleting bot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete bot',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}