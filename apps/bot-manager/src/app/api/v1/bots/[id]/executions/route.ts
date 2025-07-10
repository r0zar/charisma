import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { BotExecutionSchema } from '@/schemas/bot.schema';

// Mock execution history for development
const mockExecutions = [
  {
    id: 'exec-001',
    botId: 'bot-001',
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 3000).toISOString(),
    status: 'success' as const,
    output: 'Strategy executed successfully. Swapped 500000 µSTX for USDA.',
    executionTime: 3000,
    transactionId: 'tx-001-success'
  },
  {
    id: 'exec-002',
    botId: 'bot-001',
    startedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    completedAt: new Date(Date.now() - 6 * 60 * 60 * 1000 + 1500).toISOString(),
    status: 'success' as const,
    output: 'Strategy executed successfully. No action taken - balance below threshold.',
    executionTime: 1500,
  },
  {
    id: 'exec-003',
    botId: 'bot-001',
    startedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    completedAt: new Date(Date.now() - 12 * 60 * 60 * 1000 + 2000).toISOString(),
    status: 'failure' as const,
    output: '',
    error: 'Insufficient balance for swap operation',
    executionTime: 2000,
  },
  {
    id: 'exec-004',
    botId: 'bot-001',
    startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
    completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 5000).toISOString(),
    status: 'success' as const,
    output: 'Strategy executed successfully. Swapped 750000 µSTX for USDA.',
    executionTime: 5000,
    transactionId: 'tx-002-success'
  },
  {
    id: 'exec-005',
    botId: 'bot-001',
    startedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), // 30 hours ago
    completedAt: undefined,
    status: 'timeout' as const,
    output: '',
    error: 'Execution timed out after 120 seconds',
    executionTime: 120000,
  }
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Validate bot ID
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    // Filter executions for this bot
    const botExecutions = mockExecutions
      .filter(exec => exec.botId === id)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 20); // Return last 20 executions

    // Validate each execution
    const validatedExecutions = botExecutions.map(exec => 
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