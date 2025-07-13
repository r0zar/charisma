import { NextRequest, NextResponse } from 'next/server';

import { botService } from '@/lib/services/bots/core/service';

/**
 * GET /api/v1/bots/[id]/wallet
 * Get bot wallet information (excluding sensitive data)
 * Query params:
 * - userId: user ID that owns the bot (required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: botId } = await params;

    const bot = await botService.getBot(botId);
    if (!bot) {
      return NextResponse.json(
        {
          error: 'Bot not found',
          message: `Bot ${botId} not found`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Return wallet information (excluding sensitive data)
    const walletInfo = {
      walletAddress: bot.id, // Bot ID is now the wallet address
      hasEncryptedWallet: !!(bot.encryptedWallet && bot.walletIv),
      stxBalance: 0, // Analytics data moved to separate endpoint
      lpTokenBalances: [], // Analytics data moved to separate endpoint
      rewardTokenBalances: [], // Analytics data moved to separate endpoint
    };

    return NextResponse.json(
      {
        success: true,
        wallet: walletInfo,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error fetching bot wallet:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch bot wallet',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
