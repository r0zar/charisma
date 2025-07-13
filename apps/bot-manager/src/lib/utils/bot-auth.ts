import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Shared utility for bot ownership verification
 * Ensures authenticated user owns the requested bot using Clerk userId
 */
export async function verifyBotOwnership(botId: string, bot?: any) {
  // Verify authentication via Clerk
  const { userId } = await auth();
  
  if (!userId) {
    return {
      error: NextResponse.json(
        {
          error: 'Authentication required',
          message: 'User must be authenticated to access bot resources',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      ),
      userId: null
    };
  }

  // If bot is provided, verify ownership using clerkUserId
  if (bot) {
    // Check if bot has clerkUserId (new system) or fall back to legacy ownerId check
    const isOwner = bot.clerkUserId ? 
      bot.clerkUserId === userId : 
      false; // Legacy bots without clerkUserId are not accessible via new system

    if (!isOwner) {
      console.warn(`❌ Unauthorized bot access attempt: user ${userId} tried to access bot ${botId} owned by ${bot.clerkUserId || bot.ownerId}`);
      return {
        error: NextResponse.json(
          {
            error: 'Unauthorized',
            message: 'You can only access bots that you own',
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        ),
        userId
      };
    }
  }

  console.log(`✅ Authenticated bot access from user ${userId} for bot ${botId}`);
  
  return {
    error: null,
    userId
  };
}

/**
 * Enhanced utility that also loads and verifies bot data
 */
export async function loadAndVerifyBot(botId: string, botService: any) {
  // First verify authentication
  const authResult = await verifyBotOwnership(botId);
  if (authResult.error) {
    return { ...authResult, bot: null };
  }

  // Load bot data using Clerk userId
  let bot = null;

  // Try to get user's bot first using Clerk userId
  if (authResult.userId) {
    const userBots = await botService.getAllBotsByClerkUserId(authResult.userId);
    bot = userBots.find((b: any) => b.id === botId);
  }

  // Fallback to scanning all bots if not found in user's bots
  if (!bot) {
    const allBots = await botService.scanAllBots();
    bot = allBots.find((b: any) => b.id === botId);
  }

  if (!bot) {
    return {
      error: NextResponse.json(
        {
          error: 'Bot not found',
          message: `Bot with ID '${botId}' does not exist`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      ),
      userId: authResult.userId,
      bot: null
    };
  }

  // Verify ownership now that we have the bot
  const ownershipResult = await verifyBotOwnership(botId, bot);
  if (ownershipResult.error) {
    return { ...ownershipResult, bot };
  }

  return {
    error: null,
    userId: authResult.userId,
    bot
  };
}