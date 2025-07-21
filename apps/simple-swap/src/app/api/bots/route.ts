import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { BotData } from '@/types/bot';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 400 }
      );
    }

    // Get user's bot list
    const userBotsKey = `user_bots:${userAddress}`;
    const botIds = await kv.get<string[]>(userBotsKey) || [];

    if (botIds.length === 0) {
      return NextResponse.json({ bots: [] });
    }

    // Fetch all bot data
    const bots: BotData[] = [];
    for (const botId of botIds) {
      const botStorageKey = `bot:${userAddress}:${botId}`;
      const botData = await kv.get<BotData>(botStorageKey);
      if (botData) {
        bots.push(botData);
      }
    }

    // Sort by creation date (newest first)
    bots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ bots }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
      }
    });

  } catch (error) {
    console.error('Failed to fetch bots:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}