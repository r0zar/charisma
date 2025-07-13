import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { botService } from '@/lib/services/bots/core/service';

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

    const bot = await botService.getBot(botId, { includeExecutions: true });
    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      executions: bot.executions,
      total: bot.executions?.length || 0
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