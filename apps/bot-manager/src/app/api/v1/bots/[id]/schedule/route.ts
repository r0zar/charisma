import { NextRequest, NextResponse } from 'next/server';
import { botDataStore, isKVAvailable } from '@/lib/infrastructure/storage';
import { config } from '@/lib/infrastructure/config/loading';
import { CronExpressionParser } from 'cron-parser';
import { verifySignatureAndGetSignerWithTimestamp } from 'blaze-sdk';

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
    
    // Check if bot API is enabled
    if (!config.enableAPIBots) {
      return NextResponse.json(
        { 
          error: 'Bot API disabled',
          message: 'Bot scheduling API is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    // Check KV availability
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
    
    // Get bot
    const bot = await botDataStore.getBot(userId, botId);
    if (!bot) {
      return NextResponse.json(
        { 
          error: 'Bot not found',
          message: `Bot ${botId} not found for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
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
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const useDefault = searchParams.get('default') === 'true';
    
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

    // Check for signature-based authentication
    const hasSignatureHeaders = request.headers.get('x-signature') && 
                                request.headers.get('x-public-key') && 
                                request.headers.get('x-timestamp');

    if (hasSignatureHeaders && userId) {
      // The message should match what the client signed - we need to extract it from the request
      // For now, we'll reconstruct it based on the pattern used in the frontend
      // In a production system, the message could be included in the request body
      
      // Try to extract timestamp from headers to reconstruct the exact message
      const timestamp = request.headers.get('x-timestamp');
      const baseMessage = `update_schedule_${botId}`;
      
      // For timestamped verification, we need to parse the signed message structure
      const verificationResult = await verifySignatureAndGetSignerWithTimestamp(request, {
        message: baseMessage,
        ttl: 5 // 5 minute window
      });

      if (!verificationResult.ok) {
        return NextResponse.json(
          { 
            error: 'Authentication failed',
            message: verificationResult.error,
            timestamp: new Date().toISOString(),
          },
          { status: verificationResult.status }
        );
      }

      // Check if the signer matches the provided userId
      if (verificationResult.signer !== userId) {
        return NextResponse.json(
          { 
            error: 'Unauthorized',
            message: 'Signature does not match the provided user ID',
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        );
      }

      console.log(`[BotScheduleAPI] Authenticated request from ${verificationResult.signer} for bot ${botId}`);
    } else if (!useDefault) {
      console.warn(`[BotScheduleAPI] Unauthenticated request for bot ${botId} from user ${userId}`);
    }
    
    // Check if bot API is enabled
    if (!config.enableAPIBots) {
      return NextResponse.json(
        { 
          error: 'Bot API disabled',
          message: 'Bot scheduling management is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    // Check KV availability
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

    // Handle mock data scenario
    if (useDefault || !config.enableAPIBots) {
      // For mock data, just return success response
      let nextExecution: string | undefined;
      if (isScheduled && cronSchedule) {
        try {
          const interval = CronExpressionParser.parse(cronSchedule);
          nextExecution = interval.next().toISOString() || undefined;
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

      return NextResponse.json(
        {
          success: true,
          message: `Bot scheduling ${isScheduled ? 'enabled' : 'disabled'} (mock mode)`,
          schedule: {
            isScheduled,
            cronSchedule: isScheduled ? cronSchedule : undefined,
            nextExecution: isScheduled ? nextExecution : undefined,
            lastExecution: undefined,
            executionCount: 0,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
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
    
    // Get bot
    const bot = await botDataStore.getBot(userId || 'default-user', botId);
    if (!bot) {
      return NextResponse.json(
        { 
          error: 'Bot not found',
          message: `Bot ${botId} not found for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
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
    await botDataStore.updateBot(userId || 'default-user', updatedBot);
    
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
    
    // Check if bot API is enabled
    if (!config.enableAPIBots) {
      return NextResponse.json(
        { 
          error: 'Bot API disabled',
          message: 'Bot scheduling management is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    // Check KV availability
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
    
    // Get bot
    const bot = await botDataStore.getBot(userId, botId);
    if (!bot) {
      return NextResponse.json(
        { 
          error: 'Bot not found',
          message: `Bot ${botId} not found for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
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
    await botDataStore.updateBot(userId, updatedBot);
    
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