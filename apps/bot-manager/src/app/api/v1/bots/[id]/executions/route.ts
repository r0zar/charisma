import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { executionDataStore } from '@/lib/modules/storage';
import { BotExecutionSchema } from '@/schemas/bot.schema';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: botId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    // Validate required parameters
    if (!botId || typeof botId !== 'string') {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Fetch executions from KV store
    const executions = await executionDataStore.getExecutions(userId, botId, 20);

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