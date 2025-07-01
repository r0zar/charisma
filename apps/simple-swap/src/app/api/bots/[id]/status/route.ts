import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { verifySignedRequest } from 'blaze-sdk';
import { BotData, UpdateStatusRequest } from '@/types/bot';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const botId = await params.id;
    const body: UpdateStatusRequest = await request.json();

    const { status, userAddress } = body;

    // Validate required fields
    if (!status || !userAddress || !botId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate status value
    const validStatuses = ['active', 'paused', 'inactive'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }

    // Verify Blaze SDK auth signature
    const authResult = await verifySignedRequest(request, {
      message: userAddress,
      expectedAddress: userAddress
    });

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Get bot data
    const botStorageKey = `bot:${userAddress}:${botId}`;
    const botData = await kv.get<BotData>(botStorageKey);

    if (!botData) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    // Verify bot ownership
    if (botData.userId !== userAddress) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Update bot status
    const updatedBotData: BotData = {
      ...botData,
      status,
      lastActive: new Date().toISOString()
    };

    // Save updated bot data
    await kv.set(botStorageKey, updatedBotData);

    // Return updated bot data
    return NextResponse.json({
      id: updatedBotData.id,
      name: updatedBotData.name,
      strategy: updatedBotData.strategy,
      status: updatedBotData.status,
      walletAddress: updatedBotData.walletAddress,
      balance: updatedBotData.balance,
      dailyPnL: updatedBotData.dailyPnL,
      totalPnL: updatedBotData.totalPnL,
      lastActive: updatedBotData.lastActive,
      createdAt: updatedBotData.createdAt
    });

  } catch (error) {
    console.error('Failed to update bot status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const botId = await params.id;
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress || !botId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Verify Blaze SDK auth signature
    const authResult = await verifySignedRequest(request, {
      message: userAddress,
      expectedAddress: userAddress
    });

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Get bot data first to verify ownership
    const botStorageKey = `bot:${userAddress}:${botId}`;
    const botData = await kv.get<BotData>(botStorageKey);

    if (!botData) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    // Verify bot ownership
    if (botData.userId !== userAddress) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Delete bot data
    await kv.del(botStorageKey);

    // Delete wallet data
    const walletStorageKey = `wallet:${userAddress}:${botId}`;
    await kv.del(walletStorageKey);

    // Remove from user's bot list
    const userBotsKey = `user_bots:${userAddress}`;
    const existingBots = await kv.get<string[]>(userBotsKey) || [];
    const updatedBots = existingBots.filter(id => id !== botId);
    await kv.set(userBotsKey, updatedBots);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to delete bot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}