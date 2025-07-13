import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { botService } from '@/lib/services/bots/core/service';
import { sandboxService } from '@/lib/services/sandbox/service';

/**
 * POST /api/v1/bots/[id]/execute
 * 
 * Execute a bot strategy in a secure Vercel Sandbox environment.
 * Takes the bot ID from the URL parameter and strategy code from the request body.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const botId = params.id;

    // Parse request body
    const body = await request.json();
    const { code, timeout = 2, enableLogs = true } = body;

    // Validate required fields
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        {
          error: 'Missing or invalid strategy code',
          message: 'Strategy code is required and must be a string',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Load bot data using the same logic as frontend
    let bot = null;

    // First try API if enabled
    if (process.env.NEXT_PUBLIC_ENABLE_API_BOTS === 'true') {
      try {
        const userId = process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
        const apiUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1'}/bots/${botId}?userId=${encodeURIComponent(userId)}`;
        const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3420'}${apiUrl}`);
        if (response.ok) {
          const apiBot = await response.json();
          bot = apiBot.bot || apiBot;
        }
      } catch (error) {
        console.warn(`Failed to load bot ${botId} from API, falling back to static data:`, error);
      }
    }

    // Fallback to static data if API failed or not enabled
    if (!bot) {
      const allBots = await botService.listBots() // Get all bots;
      bot = allBots.find(b => b.id === botId);
    }

    if (!bot) {
      return NextResponse.json(
        {
          error: 'Bot not found',
          message: `Bot with ID '${botId}' does not exist in API or static data`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Verify authentication via Clerk
    const { userId } = await auth();

    if (!userId) {
      console.warn(`❌ Unauthenticated bot execution request for bot: ${botId}`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'User must be authenticated to execute bots',
        },
        { status: 401 }
      );
    }

    // Verify user owns this bot using clerkUserId
    const isOwner = bot.ownerId ?
      bot.ownerId === userId :
      false; // Legacy bots without clerkUserId are not accessible via new system

    if (!isOwner) {
      console.warn(`❌ Unauthorized bot execution attempt: user ${userId} tried to execute bot ${botId} owned by ${bot.ownerId || bot.ownerId}`);
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'You can only execute bots that you own',
        },
        { status: 403 }
      );
    }

    console.log(`✅ Authenticated bot execution request from user ${userId} for bot ${botId}`);

    // Execute strategy in sandbox
    const result = await sandboxService.executeStrategy(code, bot, {
      timeout,
      enableLogs
    });

    // Return execution result
    return NextResponse.json({
      success: result.success,
      result: result.result,
      logs: result.logs,
      error: result.error,
      executionTime: result.executionTime,
      sandboxId: result.sandboxId,
      botContext: result.botContext,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Sandbox execution API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/bots/[id]/execute
 * 
 * Get information about sandbox execution capabilities for this bot.
 * This can be used to check if the bot exists and get its current status.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const botId = params.id;

    // Load bot data using the same logic as frontend
    let bot = null;

    // First try API if enabled
    if (process.env.NEXT_PUBLIC_ENABLE_API_BOTS === 'true') {
      try {
        const userId = process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
        const apiUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1'}/bots/${botId}?userId=${encodeURIComponent(userId)}`;
        const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3420'}${apiUrl}`);
        if (response.ok) {
          const apiBot = await response.json();
          bot = apiBot.bot || apiBot;
        }
      } catch (error) {
        console.warn(`Failed to load bot ${botId} from API, falling back to static data:`, error);
      }
    }

    // Fallback to static data if API failed or not enabled
    if (!bot) {
      const allBots = await botService.listBots() // Get all bots;
      bot = allBots.find(b => b.id === botId);
    }

    if (!bot) {
      return NextResponse.json(
        {
          error: 'Bot not found',
          message: `Bot with ID '${botId}' does not exist in API or static data`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Return bot execution capabilities
    return NextResponse.json({
      botId: bot.id,
      name: bot.name,
      status: bot.status,
      canExecute: true,
      supportedRuntimes: ['node22'],
      maxTimeout: 5, // minutes
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Sandbox info API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}