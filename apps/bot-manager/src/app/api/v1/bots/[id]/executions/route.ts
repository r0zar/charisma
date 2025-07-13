import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { executionDataStore } from '@/lib/modules/storage';
import { botService } from '@/lib/services/bots/core/service';
import { loadAndVerifyBot } from '@/lib/utils/bot-auth';
import { BotExecutionSchema } from '@/schemas/bot.schema';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: botId } = await params;

    // Validate required parameters
    if (!botId || typeof botId !== 'string') {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    // Verify authentication and ownership
    const authResult = await loadAndVerifyBot(botId, botService);
    if (authResult.error) {
      return authResult.error;
    }

    const { userId, bot } = authResult;

    // Try to fetch executions using multiple strategies for backward compatibility
    let executions: any[] = [];
    
    console.log(`[Executions API] Fetching executions for bot ${botId}:`, {
      clerkUserId: bot.clerkUserId,
      ownerId: bot.ownerId,
      authUserId: userId
    });
    
    // Strategy 1: Use Clerk userId (new system)
    if (bot.clerkUserId) {
      console.log(`[Executions API] Trying Clerk userId: ${bot.clerkUserId}`);
      executions = await executionDataStore.getExecutions(bot.clerkUserId, botId, 20);
      console.log(`[Executions API] Found ${executions.length} executions with Clerk userId`);
    }
    
    // Strategy 2: If no executions found and bot has legacy ownerId, try that
    if (executions.length === 0 && bot.ownerId) {
      console.log(`[Executions API] Trying legacy ownerId: ${bot.ownerId}`);
      executions = await executionDataStore.getExecutions(bot.ownerId, botId, 20);
      console.log(`[Executions API] Found ${executions.length} executions with legacy ownerId`);
    }

    // Validate each execution (they should already be valid from storage)
    const validatedExecutions = executions.map(exec =>
      BotExecutionSchema.parse(exec)
    );

    return NextResponse.json({
      executions: validatedExecutions,
      total: validatedExecutions.length
    });

  } catch (error) {
    console.error('Error fetching bot executions:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid execution data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch execution history' },
      { status: 500 }
    );
  }
}