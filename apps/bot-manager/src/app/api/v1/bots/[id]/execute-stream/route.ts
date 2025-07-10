import { Sandbox } from '@vercel/sandbox';
import { NextRequest } from 'next/server';

import { sandboxService } from '@/lib/features/sandbox/service';
import { loadAppStateConfigurableWithFallback } from '@/lib/infrastructure/data/loader.server';

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
    const { code, testMode = true, timeout = 2, enableLogs = true } = body;

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

    // Create readable stream for real-time execution
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Helper function to send SSE data
        const sendData = (data: any) => {
          const chunk = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
          controller.enqueue(chunk);
        };

        let sandbox: any = null;
        const startTime = Date.now();

        try {
          // Send initial status
          sendData({
            type: 'status',
            message: 'Initializing sandbox...',
            timestamp: new Date().toISOString()
          });

          // Validate credentials
          if (!process.env.VERCEL_TOKEN || !process.env.VERCEL_TEAM_ID || !process.env.VERCEL_PROJECT_ID) {
            throw new Error('Missing required Vercel credentials');
          }

          // Build bot context
          const botContext = await sandboxService.buildBotContext(bot, testMode);

          sendData({
            type: 'status',
            message: `Creating sandbox for bot: ${bot.name}`,
            timestamp: new Date().toISOString()
          });

          // Create wrapper code
          const wrapperCode = sandboxService.createStrategyWrapper(code, botContext);

          // Create sandbox
          sandbox = await Sandbox.create({
            runtime: 'node22',
            timeout: timeout * 60 * 1000, // Convert minutes to milliseconds
            teamId: process.env.VERCEL_TEAM_ID,
            projectId: process.env.VERCEL_PROJECT_ID,
            token: process.env.VERCEL_TOKEN,
          });

          sendData({
            type: 'status',
            message: `Sandbox created: ${sandbox.sandboxId}`,
            timestamp: new Date().toISOString()
          });

          // Write code to sandbox
          await sandbox.writeFiles([
            {
              path: 'strategy.js',
              content: Buffer.from(wrapperCode, 'utf8')
            }
          ]);

          sendData({
            type: 'status',
            message: 'Code uploaded, executing strategy...',
            timestamp: new Date().toISOString()
          });

          // Execute with real-time streaming output
          let allOutput = '';
          let allError = '';

          const cmd = await sandbox.runCommand({
            cmd: 'node',
            args: ['strategy.js'],
            detached: true,  // Run in detached mode to get Command instance
          });

          // Stream logs in real-time
          if (enableLogs) {
            for await (const log of cmd.logs()) {
              const logData = log.data.toString();

              if (log.stream === "stdout") {
                allOutput += logData;
                // Send individual lines as they come, but filter out execution markers
                const lines = logData.split('\n').filter((line: string) => line.trim());
                for (const line of lines) {
                  // Filter out execution control markers from user-visible logs
                  if (!line.startsWith('STRATEGY_EXECUTION_COMPLETE') &&
                    !line.startsWith('STRATEGY_EXECUTION_ERROR:')) {
                    sendData({
                      type: 'log',
                      level: 'info',
                      message: line,
                      timestamp: new Date().toISOString()
                    });
                  }
                }
              } else if (log.stream === "stderr") {
                allError += logData;
                // Send individual lines as they come
                const lines = logData.split('\n').filter((line: string) => line.trim());
                for (const line of lines) {
                  sendData({
                    type: 'log',
                    level: 'error',
                    message: line,
                    timestamp: new Date().toISOString()
                  });
                }
              }
            }
          } else {
            // If logs are disabled, still wait for completion
            for await (const log of cmd.logs()) {
              if (log.stream === "stdout") {
                allOutput += log.data.toString();
              } else if (log.stream === "stderr") {
                allError += log.data.toString();
              }
            }
          }

          // Get the final result
          const result = await cmd;

          const executionTime = Date.now() - startTime;

          // Check for execution completion markers
          let executionComplete = false;
          let executionError: string | undefined;

          if (allOutput) {
            const lines = allOutput.split('\n');
            executionComplete = lines.some(line => line.startsWith('STRATEGY_EXECUTION_COMPLETE'));
            const errorLine = lines.find(line => line.startsWith('STRATEGY_EXECUTION_ERROR:'));
            if (errorLine) {
              executionError = errorLine.replace('STRATEGY_EXECUTION_ERROR:', '').trim();
            }

            // Debug logging (server-side only)
            console.log('[DEBUG] Strategy execution analysis:');
            console.log('- Exit code:', result.exitCode);
            console.log('- Execution complete marker found:', executionComplete);
            console.log('- Execution error:', executionError || 'none');
            console.log('- Total output lines:', lines.length);
            console.log('- Output sample:', lines.slice(0, 5).join('\\n'));
          }

          // Simple result based on completion
          const strategyResult = executionComplete ? { message: 'Strategy executed successfully' } : null;

          // Send final result - require both successful exit AND completion marker
          // Note: exitCode may be undefined in some cases, treat as success if execution completed without error
          const success = (result.exitCode === 0 || result.exitCode === undefined) && executionComplete && !executionError;
          sendData({
            type: 'result',
            success,
            result: strategyResult,
            error: executionError,
            exitCode: result.exitCode,
            executionTime,
            sandboxId: sandbox.sandboxId,
            botContext: testMode ? botContext : undefined,
            timestamp: new Date().toISOString()
          });

          sendData({
            type: 'status',
            message: `Execution completed in ${executionTime}ms`,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          const executionTime = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';

          sendData({
            type: 'error',
            error: errorMessage,
            executionTime,
            sandboxId: sandbox?.sandboxId,
            timestamp: new Date().toISOString()
          });

        } finally {
          // Clean up sandbox
          if (sandbox) {
            try {
              await sandbox.stop();
              sendData({
                type: 'status',
                message: 'Sandbox cleaned up',
                timestamp: new Date().toISOString()
              });
            } catch (cleanupError) {
              sendData({
                type: 'log',
                level: 'warn',
                message: 'Failed to cleanup sandbox',
                timestamp: new Date().toISOString()
              });
            }
          }

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