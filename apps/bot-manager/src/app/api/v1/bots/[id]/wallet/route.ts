import { NextRequest, NextResponse } from 'next/server';

import {encryptWalletCredentials, generateBotWallet } from '@/lib/modules/security/wallet-encryption';
import { botDataStore } from '@/lib/modules/storage';
import { ENABLE_API_BOTS } from '@/lib/utils/config';

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
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Missing userId',
          message: 'userId query parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }
    
    // Check if bot API is enabled
    if (!ENABLE_API_BOTS) {
      return NextResponse.json(
        { 
          error: 'Bot API disabled',
          message: 'Bot wallet API is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    
    // Get bot
    const bot = await botDataStore.getBot(userId, botId);
    if (!bot) {
      return NextResponse.json(
        { 
          error: 'Bot not found',
          message: `Bot ${botId} not found for user ${userId}`,
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

/**
 * POST /api/v1/bots/[id]/wallet
 * Generate new wallet for bot or regenerate existing wallet
 * Query params:
 * - userId: user ID that owns the bot (required)
 * Body: { action: 'generate' | 'regenerate' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: botId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Missing userId',
          message: 'userId query parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }
    
    // Check if bot API is enabled
    if (!ENABLE_API_BOTS) {
      return NextResponse.json(
        { 
          error: 'Bot API disabled',
          message: 'Bot wallet management is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    
    const body = await request.json();
    const { action } = body;
    
    if (!action || !['generate', 'regenerate'].includes(action)) {
      return NextResponse.json(
        { 
          error: 'Invalid action',
          message: 'Action must be "generate" or "regenerate"',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }
    
    // Get bot
    const bot = await botDataStore.getBot(userId, botId);
    if (!bot) {
      return NextResponse.json(
        { 
          error: 'Bot not found',
          message: `Bot ${botId} not found for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }
    
    // Check if wallet already exists for 'generate' action
    if (action === 'generate' && bot.encryptedWallet && bot.walletIv) {
      return NextResponse.json(
        { 
          error: 'Wallet already exists',
          message: 'Bot already has a wallet. Use "regenerate" to create a new one.',
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }
    
    // Generate new wallet
    console.log(`[BotWalletAPI] ${action} wallet for bot ${botId}...`);
    const walletCredentials = await generateBotWallet();
    const encryptedWallet = encryptWalletCredentials(walletCredentials);
    
    // Update bot with new wallet data
    const updatedBot = {
      ...bot,
      walletAddress: walletCredentials.walletAddress,
      encryptedWallet: encryptedWallet.encryptedPrivateKey,
      walletIv: encryptedWallet.privateKeyIv,
      // Reset balances for regenerated wallet
      stxBalance: 0,
      lpTokenBalances: [],
      rewardTokenBalances: [],
    };
    
    // Save updated bot
    await botDataStore.updateBot(userId, updatedBot);
    
    console.log(`[BotWalletAPI] Wallet ${action}d for bot ${botId}: ${walletCredentials.walletAddress}`);
    
    return NextResponse.json(
      {
        success: true,
        message: `Wallet ${action}d successfully`,
        wallet: {
          walletAddress: walletCredentials.walletAddress,
          hasEncryptedWallet: true,
          stxBalance: 0,
          lpTokenBalances: [],
          rewardTokenBalances: [],
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Error managing bot wallet:', error);
    return NextResponse.json(
      { 
        error: 'Failed to manage bot wallet',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/bots/[id]/wallet
 * Remove wallet from bot (clear encrypted data)
 * Query params:
 * - userId: user ID that owns the bot (required)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: botId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Missing userId',
          message: 'userId query parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }
    
    // Check if bot API is enabled
    if (!ENABLE_API_BOTS) {
      return NextResponse.json(
        { 
          error: 'Bot API disabled',
          message: 'Bot wallet management is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    
    // Get bot
    const bot = await botDataStore.getBot(userId, botId);
    if (!bot) {
      return NextResponse.json(
        { 
          error: 'Bot not found',
          message: `Bot ${botId} not found for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }
    
    // Clear wallet data
    const updatedBot = {
      ...bot,
      encryptedWallet: undefined,
      walletIv: undefined,
      // Keep the wallet address for reference but reset balances
      stxBalance: 0,
      lpTokenBalances: [],
      rewardTokenBalances: [],
    };
    
    // Save updated bot
    await botDataStore.updateBot(userId, updatedBot);
    
    console.log(`[BotWalletAPI] Wallet cleared for bot ${botId}`);
    
    return NextResponse.json(
      {
        success: true,
        message: 'Wallet cleared successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Error clearing bot wallet:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clear bot wallet',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}