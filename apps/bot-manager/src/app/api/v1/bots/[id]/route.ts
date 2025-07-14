import { NextRequest, NextResponse } from 'next/server';

import { botService } from '@/lib/services/bots/core/service';
import { ENABLE_API_BOTS } from '@/lib/utils/config';

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
    const useDefault = searchParams.get('default') === 'true';
    const { id: botId } = await params;

    // Check if bot API is enabled
    if (!ENABLE_API_BOTS) {
      return NextResponse.json(
        {
          error: 'Bot API not enabled',
          message: 'Bot API feature is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // For default requests, skip authentication (all bots)
    if (useDefault) {
      const allBots = await botService.listBots(); // Get all bots
      const bot = allBots.find(b => b.id === botId);

      if (!bot) {
        return NextResponse.json(
          {
            error: 'Bot not found',
            message: `Bot ${botId} not found`,
            timestamp: new Date().toISOString(),
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        bot,
        source: 'static',
        timestamp: new Date().toISOString(),
      });
    }

    const bot = await botService.getBot(botId);

    const responseData = {
      bot,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(responseData);
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
    const { id: botId } = await params;
    const body = await request.json();

    // Check if bot API is enabled
    if (!ENABLE_API_BOTS) {
      return NextResponse.json(
        {
          error: 'Bot API not enabled',
          message: 'Bot API feature is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    const bot = await botService.getBot(botId);

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

    // Update bot in KV store
    const updatedBot = await botService.updateBot(botId, body);

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
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(responseData);
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
    const { id: botId } = await params;

    // Check if bot API is enabled
    if (!ENABLE_API_BOTS) {
      return NextResponse.json(
        {
          error: 'Bot API not enabled',
          message: 'Bot API feature is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Delete bot from KV store
    await botService.deleteBot(botId);

    const responseData = {
      message: 'Bot deleted successfully',
      botId,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(responseData);
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