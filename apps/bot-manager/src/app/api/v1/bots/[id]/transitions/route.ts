import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getValidTransitions } from '@/lib/services/bots/core/bot-state-machine';
import { botService } from '@/lib/services/bots/core/service';

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

    const { action, reason } = await request.json();

    const bot = await botService.getBot(botId);
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
      reason
    });

    // Prepare update data with transition action
    const updateData: any = {
      transitionAction: action,
      transitionReason: reason
    };

    // Additional updates based on transition type
    switch (action) {
      case 'reset':
        // Reset execution counters on reset
        updateData.executionCount = 0;
        updateData.lastExecution = undefined;
        updateData.nextExecution = undefined;
        break;
    }

    try {
      // Request the transition through new updateBot method
      const updatedBot = await botService.updateBot(botId, updateData);

      console.log('Bot state transition completed', {
        botId,
        botName: bot.name,
        currentStatus: bot.status,
        newStatus: updatedBot.status,
        action,
        userId: bot.ownerId
      });

      // Return the successful transition result
      return NextResponse.json({
        success: true,
        bot: updatedBot,
        transition: {
          fromStatus: bot.status,
          toStatus: updatedBot.status,
          action,
          timestamp: new Date().toISOString()
        }
      });
    } catch (transitionError) {
      console.warn('Bot state transition failed', {
        botId,
        action,
        currentStatus: bot.status,
        error: transitionError instanceof Error ? transitionError.message : String(transitionError)
      });

      return NextResponse.json(
        {
          error: 'State transition not allowed',
          details: {
            fromStatus: bot.status,
            action,
            message: transitionError instanceof Error ? transitionError.message : 'Unknown error'
          }
        },
        { status: 400 }
      );
    }

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
    // Get the bot with state info
    const bot = await botService.getBot(botId);
    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    // Get enhanced bot data with state machine info
    const botsWithState = await botService.listBots({
      includeStateInfo: true,
      limit: 1
    });
    const botWithState = botsWithState.find(b => b.id === botId);

    // Get available transitions using state machine
    const validTransitions = getValidTransitions(bot.status);

    return NextResponse.json({
      botId,
      currentStatus: bot.status,
      statusDescription: botWithState?.statusDescription || 'Unknown status',
      validTransitions: validTransitions.map((t: any) => ({
        action: t.action,
        toStatus: t.to,
        requiresValidation: t.requiresValidation,
        conditions: t.conditions
      })),
      availableActions: botWithState?.availableActions || [],
      recommendedActions: botWithState?.recommendedActions || []
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