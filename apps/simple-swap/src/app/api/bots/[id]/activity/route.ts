import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { BotActivityRecord, BotData } from '@/types/bot';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const botId = await params.id;

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 400 }
      );
    }

    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID required' },
        { status: 400 }
      );
    }

    // Verify bot exists and belongs to user
    const botStorageKey = `bot:${userAddress}:${botId}`;
    const botData = await kv.get<BotData>(botStorageKey);

    if (!botData) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    // Get activity records
    const activityKey = `bot_activity:${userAddress}:${botId}`;
    const activities = await kv.get<BotActivityRecord[]>(activityKey) || [];

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Apply pagination
    const paginatedActivities = activities.slice(offset, offset + limit);

    // Add explorer URLs for transactions
    const activitiesWithUrls = paginatedActivities.map(activity => ({
      ...activity,
      explorerUrl: activity.txid ? `https://explorer.stacks.co/txid/${activity.txid}` : undefined
    }));

    return NextResponse.json({
      activities: activitiesWithUrls,
      pagination: {
        page,
        limit,
        total: activities.length,
        totalPages: Math.ceil(activities.length / limit)
      },
      bot: {
        id: botData.id,
        name: botData.name,
        strategy: botData.strategy,
        status: botData.status
      }
    });

  } catch (error) {
    console.error('Failed to fetch bot activity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}