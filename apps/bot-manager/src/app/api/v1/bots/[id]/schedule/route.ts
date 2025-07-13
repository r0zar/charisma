import { CronExpressionParser } from 'cron-parser';
import { NextRequest, NextResponse } from 'next/server';

import { botDataStore } from '@/lib/modules/storage';
import { botService } from '@/lib/services/bots/core/service';
import { loadAndVerifyBot } from '@/lib/utils/bot-auth';
import { ENABLE_API_BOTS } from '@/lib/utils/config';

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

    // Verify authentication and ownership
    const authResult = await loadAndVerifyBot(botId, botService);
    if (authResult.error) {
      return authResult.error;
    }

    const { userId, bot } = authResult;

    // Check if bot API is enabled
    if (!ENABLE_API_BOTS) {
      return NextResponse.json(
        {
          error: 'Bot API disabled',
          message: 'Bot scheduling API is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Return scheduling information
    const scheduleInfo = {
      isScheduled: bot.isScheduled || false,
      cronSchedule: bot.cronSchedule,
      lastExecution: bot.lastExecution,
      nextExecution: bot.nextExecution,
      executionCount: bot.executionCount || 0,
      status: bot.status,
    };

    // Calculate next execution if schedule exists
    if (bot.cronSchedule && bot.isScheduled) {
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
 * Body: { isScheduled: boolean, cronSchedule?: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: botId } = await params;

    // Verify authentication and ownership
    const authResult = await loadAndVerifyBot(botId, botService);
    if (authResult.error) {
      return authResult.error;
    }

    const { userId, bot } = authResult;
    console.log(`[BotScheduleAPI] Authenticated request from user ${userId} for bot ${botId}`);

    // Check if bot API is enabled
    if (!ENABLE_API_BOTS) {
      return NextResponse.json(
        {
          error: 'Bot API disabled',
          message: 'Bot scheduling management is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }


    const body = await request.json();
    const { isScheduled, cronSchedule } = body;

    if (typeof isScheduled !== 'boolean') {
      return NextResponse.json(
        {
          error: 'Invalid data',
          message: 'isScheduled must be a boolean',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }


    // Validate cron expression if scheduling is enabled
    if (isScheduled && cronSchedule) {
      try {
        const interval = CronExpressionParser.parse(cronSchedule);
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
    if (isScheduled && (!bot.encryptedWallet || !bot.walletIv)) {
      return NextResponse.json(
        {
          error: 'Wallet required',
          message: 'Bot must have a wallet configured for scheduled execution',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Calculate next execution if enabling schedule
    let nextExecution: string | undefined;
    if (isScheduled && cronSchedule) {
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
      isScheduled,
      cronSchedule: isScheduled ? cronSchedule : undefined,
      nextExecution: isScheduled ? nextExecution : undefined,
      // Clear last execution if disabling schedule
      lastExecution: isScheduled ? bot.lastExecution : undefined,
    };

    // Save updated bot
    await botDataStore.updateBotByClerkUserId(userId, updatedBot);

    console.log(`[BotScheduleAPI] Bot ${botId} scheduling ${isScheduled ? 'enabled' : 'disabled'}${cronSchedule ? ` with schedule: ${cronSchedule}` : ''}`);

    return NextResponse.json(
      {
        success: true,
        message: `Bot scheduling ${isScheduled ? 'enabled' : 'disabled'}`,
        schedule: {
          isScheduled,
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
 * Disable bot scheduling
 * Query params:
 * - userId: user ID that owns the bot (required)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: botId } = await params;

    // Verify authentication and ownership
    const authResult = await loadAndVerifyBot(botId, botService);
    if (authResult.error) {
      return authResult.error;
    }

    const { userId, bot } = authResult;

    // Check if bot API is enabled
    if (!ENABLE_API_BOTS) {
      return NextResponse.json(
        {
          error: 'Bot API disabled',
          message: 'Bot scheduling management is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Disable scheduling
    const updatedBot = {
      ...bot,
      isScheduled: false,
      cronSchedule: undefined,
      nextExecution: undefined,
    };

    // Save updated bot
    await botDataStore.updateBotByClerkUserId(userId, updatedBot);

    console.log(`[BotScheduleAPI] Scheduling disabled for bot ${botId}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Bot scheduling disabled',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error disabling bot schedule:', error);
    return NextResponse.json(
      {
        error: 'Failed to disable bot schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}