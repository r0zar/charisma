import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';

import { botService } from '@/lib/services/bots/core/service';
import { sandboxService } from '@/lib/services/sandbox/service';

/**
 * POST /api/v1/bots/[id]/execute-stream
 * 
 * Execute a bot strategy in a secure Vercel Sandbox environment with real-time streaming logs.
 * Returns a ReadableStream for Server-Sent Events (SSE) compatible streaming.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const botId = params.id;

  try {
    // Parse request body
    const body = await request.json();
    const { code, timeout = 2, enableLogs = true } = body;

    // Validate required fields
    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({
          error: 'Missing or invalid strategy code',
          message: 'Strategy code is required and must be a string',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify authentication via Clerk
    const { userId } = await auth();

    if (!userId) {
      console.warn(`❌ Unauthenticated bot execution stream request for bot: ${botId}`);
      return new Response(
        JSON.stringify({
          error: 'Authentication required',
          message: 'User must be authenticated to execute bots',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Note: Bot execution uses the bot's own encrypted wallet, not the user's wallet

    // Load bot data using the same logic as frontend
    let bot = null;

    // First try API if enabled
    if (process.env.NEXT_PUBLIC_ENABLE_API_BOTS === 'true') {
      try {
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
      return new Response(
        JSON.stringify({
          error: 'Bot not found',
          message: `Bot with ID '${botId}' does not exist in API or static data`,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify user owns this bot (ownerId should match Clerk userId)
    if (bot.ownerId !== userId) {
      console.warn(`❌ Unauthorized bot execution stream attempt: user ${userId} tried to execute bot ${botId} owned by ${bot.ownerId}`);
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'You can only execute bots that you own',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`✅ Authenticated bot execution stream request from user ${userId} for bot ${botId}`);

    // Create readable stream for real-time execution
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Helper function to send SSE data
        const sendData = (data: any) => {
          const chunk = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
          controller.enqueue(chunk);
        };

        try {
          // Execute strategy using SandboxService with streaming callbacks
          const result = await sandboxService.executeStrategy(
            code,
            bot,
            { timeout, enableLogs },
            {
              onStatus: (message, timestamp) => {
                sendData({
                  type: 'status',
                  message,
                  timestamp: timestamp || new Date().toISOString()
                });
              },
              onLog: (level, message, timestamp) => {
                sendData({
                  type: 'log',
                  level,
                  message,
                  timestamp: timestamp || new Date().toISOString()
                });
              },
              onResult: (result) => {
                sendData({
                  type: 'result',
                  success: result.success,
                  result: result.result,
                  logs: result.logs,
                  error: result.error,
                  executionTime: result.executionTime,
                  sandboxId: result.sandboxId,
                  botContext: result.botContext,
                  timestamp: new Date().toISOString()
                });
              }
            }
          );

          // Send final completion status if not already sent
          if (!result.success && result.error) {
            sendData({
              type: 'error',
              error: result.error,
              executionTime: result.executionTime,
              sandboxId: result.sandboxId,
              timestamp: new Date().toISOString()
            });
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
          sendData({
            type: 'error',
            error: errorMessage,
            timestamp: new Date().toISOString()
          });
        } finally {
          // End stream
          sendData({
            type: 'done',
            timestamp: new Date().toISOString()
          });

          controller.close();
        }
      }
    });

    // Return stream with proper SSE headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Streaming sandbox execution API error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}