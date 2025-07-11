import { NextRequest, NextResponse } from 'next/server';

import { botService } from '@/lib/services/bots/service';
import { type Bot, BotSchema, type CreateBotRequest, CreateBotRequestSchema } from '@/schemas/bot.schema';

/**
 * GET /api/v1/bots
 * Returns bot data (list, stats)
 * Query params:
 * - userId: user ID to get bots for (required for KV)
 * - default: 'true' to use default state (ignores KV)
 * - section: 'list' | 'stats' to get specific section
 * - status: filter bots by status (active, paused, error, setup)
 * - limit: limit number of results
 * - offset: offset for pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const useDefault = searchParams.get('default') === 'true';
    const section = searchParams.get('section') as 'list' | 'stats' | null;
    const status = searchParams.get('status');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Require userId for KV operations
    if (!userId && !useDefault) {
      return NextResponse.json(
        {
          error: 'Missing userId',
          message: 'userId query parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    let responseData;

    if (section === 'list') {
      // Get bots with filtering and pagination
      let bots = await botService.getAllBots(userId!);

      // Filter by status
      if (status) {
        bots = bots.filter(bot => bot.status === status);
      }

      // Apply pagination
      const total = bots.length;
      if (limit !== undefined) {
        bots = bots.slice(offset, offset + limit);
      }

      responseData = {
        list: bots,
        pagination: { offset, limit, total },
        source: botService.getDataSource(),
        timestamp: new Date().toISOString(),
      };
    } else if (section === 'stats') {
      // Get bot statistics
      const stats = await botService.getBotStats(userId!);
      responseData = {
        stats,
        source: botService.getDataSource(),
        timestamp: new Date().toISOString(),
      };
    } else {
      // Return all bot data
      const [bots, stats] = await Promise.all([
        botService.getAllBots(userId!),
        botService.getBotStats(userId!)
      ]);

      // Apply status filter to bots if specified
      let filteredBots = bots;
      if (status) {
        filteredBots = bots.filter(bot => bot.status === status);
      }

      // Apply pagination to bots
      const total = filteredBots.length;
      if (limit !== undefined) {
        filteredBots = filteredBots.slice(offset, offset + limit);
      }

      responseData = {
        list: filteredBots,
        stats,
        pagination: { offset, limit, total },
        source: botService.getDataSource(),
        timestamp: new Date().toISOString(),
      };
    }

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=120',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching bot data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch bot data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/bots
 * Create new bot
 * Body: CreateBotRequest
 * Query params:
 * - userId: user ID to create bot for (required)
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        {
          error: 'Missing userId',
          message: 'userId query parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check if bot creation is available
    if (!botService.isKVEnabled()) {
      return NextResponse.json(
        {
          error: 'Bot creation disabled',
          message: 'Bot creation via API is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validationResult = CreateBotRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Invalid bot data provided',
          details: validationResult.error.issues,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const createRequest: CreateBotRequest = validationResult.data;

    // Create bot using service
    const newBot = await botService.createBot(userId, createRequest);

    return NextResponse.json(
      {
        success: true,
        bot: newBot,
        message: 'Bot created successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating bot:', error);
    return NextResponse.json(
      {
        error: 'Failed to create bot',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/bots
 * Update existing bot
 * Body: Bot object
 * Query params:
 * - userId: user ID that owns the bot (required)
 * - botId: bot ID to update (required)
 */
export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const botId = searchParams.get('botId');

    if (!userId || !botId) {
      return NextResponse.json(
        {
          error: 'Missing parameters',
          message: 'userId and botId query parameters are required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check if bot updates are available
    if (!botService.isKVEnabled()) {
      return NextResponse.json(
        {
          error: 'Bot updates disabled',
          message: 'Bot updates via API are not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validationResult = BotSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Invalid bot data provided',
          details: validationResult.error.issues,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const botUpdate: Bot = validationResult.data;

    // Verify bot ID matches
    if (botUpdate.id !== botId) {
      return NextResponse.json(
        {
          error: 'ID mismatch',
          message: 'Bot ID in body must match botId query parameter',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Update bot using service
    const updatedBot = await botService.updateBot(userId, botId, botUpdate);

    return NextResponse.json(
      {
        success: true,
        bot: updatedBot,
        message: 'Bot updated successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

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
 * DELETE /api/v1/bots
 * Delete a bot
 * Query params:
 * - userId: user ID that owns the bot (required)
 * - botId: bot ID to delete (required)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const botId = searchParams.get('botId');

    if (!userId || !botId) {
      return NextResponse.json(
        {
          error: 'Missing parameters',
          message: 'userId and botId query parameters are required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check if bot deletion is available
    if (!botService.isKVEnabled()) {
      return NextResponse.json(
        {
          error: 'Bot deletion disabled',
          message: 'Bot deletion via API is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Delete bot using service
    await botService.deleteBot(userId, botId);

    return NextResponse.json(
      {
        success: true,
        message: 'Bot deleted successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

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