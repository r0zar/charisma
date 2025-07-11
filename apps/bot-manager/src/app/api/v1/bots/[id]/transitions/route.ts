import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { 
  BotStateMachine, 
  getValidTransitions} from '@/lib/services/bots/bot-state-machine';
import { botDataStore } from '@/lib/modules/storage/kv-stores/bot-store';

// Request validation schema
const TransitionRequestSchema = z.object({
  action: z.string().min(1, 'Action is required'),
  reason: z.string().optional()
});

/**
 * POST /api/v1/bots/[id]/transitions
 * Request a state transition for a bot
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: botId } = await params;
  
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = TransitionRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const { action, reason } = validation.data;

    // Get the bot
    const bot = await botDataStore.getBot(userId, botId);
    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    console.log('Bot state transition requested', {
      botId,
      botName: bot.name,
      currentStatus: bot.status,
      requestedAction: action,
      userId,
      reason
    });

    // Request the transition through state machine
    const transitionResult = await BotStateMachine.requestTransition(
      bot,
      action,
      userId,
      reason
    );

    if (!transitionResult.success) {
      console.warn('Bot state transition failed validation', {
        botId,
        action,
        fromStatus: transitionResult.fromStatus,
        toStatus: transitionResult.toStatus,
        errors: transitionResult.errors,
        transitionId: transitionResult.transitionId
      });

      return NextResponse.json(
        {
          error: 'State transition not allowed',
          details: {
            fromStatus: transitionResult.fromStatus,
            toStatus: transitionResult.toStatus,
            errors: transitionResult.errors,
            warnings: transitionResult.warnings
          },
          transitionId: transitionResult.transitionId
        },
        { status: 400 }
      );
    }

    // Apply the transition
    const updatedBot = {
      ...bot,
      status: transitionResult.toStatus,
      lastActive: new Date().toISOString()
    };

    // Additional updates based on transition
    switch (action) {
      case 'start':
      case 'resume':
        // Bot becoming active
        updatedBot.lastActive = new Date().toISOString();
        break;
      
      case 'error':
        // Record error information if provided
        if (reason) {
          updatedBot.lastActive = new Date().toISOString();
        }
        break;
      
      case 'reset':
        // Reset execution counters on reset
        updatedBot.executionCount = 0;
        updatedBot.lastExecution = undefined;
        updatedBot.nextExecution = undefined;
        break;
    }

    // Save the updated bot
    await botDataStore.updateBot(userId, updatedBot);

    console.log('Bot state transition completed', {
      botId,
      botName: bot.name,
      fromStatus: transitionResult.fromStatus,
      toStatus: transitionResult.toStatus,
      action,
      transitionId: transitionResult.transitionId,
      userId
    });

    // Return the successful transition result
    return NextResponse.json({
      success: true,
      bot: updatedBot,
      transition: {
        fromStatus: transitionResult.fromStatus,
        toStatus: transitionResult.toStatus,
        action,
        transitionId: transitionResult.transitionId,
        timestamp: transitionResult.timestamp,
        warnings: transitionResult.warnings
      }
    });

  } catch (error) {
    console.error('Bot state transition error', {
      botId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { error: 'Internal server error during state transition' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/bots/[id]/transitions
 * Get available transitions for a bot
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: botId } = await params;
  
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    // Get the bot
    const bot = await botDataStore.getBot(userId, botId);
    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    // Get available transitions
    const validTransitions = getValidTransitions(bot.status);
    const availableActions = BotStateMachine.getAvailableActions(bot);
    const recommendedActions = BotStateMachine.getRecommendedActions(bot);

    return NextResponse.json({
      botId,
      currentStatus: bot.status,
      statusDescription: BotStateMachine.getStatusDescription(bot.status),
      validTransitions: validTransitions.map(t => ({
        action: t.action,
        toStatus: t.to,
        requiresValidation: t.requiresValidation,
        conditions: t.conditions
      })),
      availableActions,
      recommendedActions
    });

  } catch (error) {
    console.error('Error fetching bot transitions', {
      botId,
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}