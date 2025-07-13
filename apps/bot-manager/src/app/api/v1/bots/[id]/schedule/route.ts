import { CronExpressionParser } from 'cron-parser';
import { NextRequest, NextResponse } from 'next/server';

import { botService } from '@/lib/services/bots/core/service';

/**
 * GET /api/v1/bots/[id]/schedule
 * Get bot scheduling information
 * Query params:
 * - userId: user ID that owns the bot (required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: botId } = await params;

    const bot = await botService.getBot(botId);

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

    // Return scheduling information
    const scheduleInfo = {
      cronSchedule: bot.cronSchedule,
      lastExecution: bot.lastExecution,
      nextExecution: bot.nextExecution,
      executionCount: bot.executionCount || 0,
      status: bot.status,
    };

    // Calculate next execution if schedule exists
    if (bot.cronSchedule) {
      try {
        const interval = CronExpressionParser.parse(bot.cronSchedule);
        const nextRun = interval.next();
        scheduleInfo.nextExecution = nextRun.toISOString() || undefined;
      } catch (error) {
        console.error(`Invalid cron expression for bot ${botId}:`, error);
      }
    }

    return NextResponse.json(
      {
        success: true,
        schedule: scheduleInfo,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error fetching bot schedule:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch bot schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/bots/[id]/schedule
 * Update bot scheduling configuration
 * Query params:
 * - userId: user ID that owns the bot (required)
 * Body: { cronSchedule?: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: botId } = await params;

    const bot = await botService.getBot(botId);

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

    const body = await request.json();
    const { cronSchedule } = body;

    // Validate cron expression if provided
    if (cronSchedule) {
      try {
        CronExpressionParser.parse(cronSchedule);
      } catch (error) {
        return NextResponse.json(
          {
            error: 'Invalid cron expression',
            message: `Invalid cron schedule: ${cronSchedule}`,
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }
    }

    // Check if bot has wallet for scheduled execution
    if (cronSchedule && (!bot.encryptedWallet || !bot.walletIv)) {
      return NextResponse.json(
        {
          error: 'Wallet required',
          message: 'Bot must have a wallet configured for scheduled execution',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Calculate next execution if setting schedule
    let nextExecution: string | undefined;
    if (cronSchedule) {
      try {
        const interval = CronExpressionParser.parse(cronSchedule);
        nextExecution = interval.next().toISOString() || undefined;
      } catch (error) {
        console.error(`Failed to calculate next execution for bot ${botId}:`, error);
      }
    }

    // Update bot with new scheduling configuration
    const updatedBot = {
      ...bot,
      cronSchedule: cronSchedule || undefined,
      nextExecution: cronSchedule ? nextExecution : undefined,
      // Clear last execution if removing schedule
      lastExecution: cronSchedule ? bot.lastExecution : undefined,
    };

    // Save updated bot
    await botService.updateBot(botId, updatedBot);

    console.log(`[BotScheduleAPI] Bot ${botId} schedule ${cronSchedule ? `updated to: ${cronSchedule}` : 'cleared'}`);

    return NextResponse.json(
      {
        success: true,
        message: `Bot schedule ${cronSchedule ? 'updated' : 'cleared'}`,
        schedule: {
          cronSchedule: updatedBot.cronSchedule,
          nextExecution: updatedBot.nextExecution,
          lastExecution: updatedBot.lastExecution,
          executionCount: updatedBot.executionCount || 0,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error updating bot schedule:', error);
    return NextResponse.json(
      {
        error: 'Failed to update bot schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/bots/[id]/schedule
 * Clear bot scheduling
 * Query params:
 * - userId: user ID that owns the bot (required)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: botId } = await params;

    const bot = await botService.getBot(botId);

    // Clear scheduling
    const updatedBot = {
      ...bot,
      cronSchedule: undefined,
      nextExecution: undefined,
    };

    // Save updated bot
    await botService.updateBot(botId, updatedBot);

    console.log(`[BotScheduleAPI] Schedule cleared for bot ${botId}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Bot schedule cleared',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error clearing bot schedule:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear bot schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}