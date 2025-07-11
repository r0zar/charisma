import { verifySignatureAndGetSignerWithTimestamp } from 'blaze-sdk';
import { NextRequest, NextResponse } from 'next/server';

import { sandboxService } from '@/lib/features/sandbox/service';
import { loadAppStateConfigurableWithFallback } from '@/lib/infrastructure/data/loader.server';
import { logger } from '@/lib/infrastructure/server/logger';

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
      const appState = await loadAppStateConfigurableWithFallback();
      bot = appState.bots.list.find(b => b.id === botId);
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

    // Verify authentication via signature headers
    const hasSignatureHeaders = request.headers.get('x-signature') &&
      request.headers.get('x-public-key') &&
      request.headers.get('x-timestamp');

    if (hasSignatureHeaders) {
      const baseMessage = `execute_bot_${botId}_${Date.now()}`;

      const verificationResult = await verifySignatureAndGetSignerWithTimestamp(request, {
        message: baseMessage,
        ttl: 5 // 5 minute window
      });

      if (!verificationResult.ok) {
        logger.warn(`❌ Authentication failed for bot execution: ${verificationResult.error}`);
        return NextResponse.json(
          {
            error: 'Authentication failed',
            message: verificationResult.error,
          },
          { status: verificationResult.status }
        );
      }

      // Verify signer matches the bot's wallet address
      if (verificationResult.signer !== bot.walletAddress) {
        logger.warn(`❌ Unauthorized bot execution attempt: ${verificationResult.signer} tried to execute bot ${botId} owned by ${bot.walletAddress}`);
        return NextResponse.json(
          {
            error: 'Unauthorized',
            message: 'You can only execute bots that you own',
          },
          { status: 403 }
        );
      }

      logger.info(`✅ Authenticated bot execution request from ${verificationResult.signer} for bot ${botId}`);
    } else {
      // No signature headers - deny access
      logger.warn(`❌ Unauthenticated bot execution request for bot: ${botId}`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Wallet signature authentication is required to execute bots',
        },
        { status: 401 }
      );
    }

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
      const appState = await loadAppStateConfigurableWithFallback();
      bot = appState.bots.list.find(b => b.id === botId);
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