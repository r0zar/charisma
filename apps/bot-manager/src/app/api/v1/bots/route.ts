import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { botService } from '@/lib/services/bots';
import { CreateBotRequestSchema, BotSchema } from '@/schemas/bot.schema';

/**
 * GET /api/v1/bots
 * Returns bots - either user-specific or all public bots
 * Query params:
 * - userId: if provided, return bots for that Clerk user ID (requires auth)
 * - status: filter bots by status (active, paused, error, setup)
 * - limit: limit number of results
 * - offset: offset for pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    let allBots;
    let stats;

    if (userId) {
      // User-specific request - requires authentication
      const { userId: clerkUserId } = await auth();
      
      if (!clerkUserId) {
        return NextResponse.json(
          { error: 'Authentication required', message: 'Must be signed in to access user bots' },
          { status: 401 }
        );
      }

      if (clerkUserId !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Can only access your own bots' },
          { status: 403 }
        );
      }

      console.log(`👤 User bot data request for ${userId} (${botService.getDataSource()})`);

      // Get user-specific bots
      allBots = await botService.getAllBotsByClerkUserId(userId);
      stats = await botService.getBotStatsByClerkUserId(userId);
    } else {
      // Public request
      console.log(`🌍 Public bot data request (${botService.getDataSource()})`);

      // Get all public bots
      allBots = await botService.getPublicBots();
      stats = await botService.getPublicBotStats();
    }
    
    // Filter by status if specified
    if (status && status !== 'all') {
      allBots = allBots.filter(bot => bot.status === status);
    }

    // Apply pagination
    const totalBots = allBots.length;
    const paginatedBots = limit 
      ? allBots.slice(offset, offset + limit)
      : allBots.slice(offset);

    const responseData = {
      list: paginatedBots, // Use 'list' for compatibility with frontend
      bots: paginatedBots,
      stats,
      pagination: {
        total: totalBots,
        offset,
        limit: limit || totalBots,
        hasMore: limit ? (offset + limit) < totalBots : false
      },
      source: botService.getDataSource(),
      timestamp: new Date().toISOString(),
    };

    console.log(`📊 Returned ${paginatedBots.length} of ${totalBots} ${userId ? 'user' : 'public'} bots`);

    const response = NextResponse.json(responseData);
    
    // Disable caching for fresh bot data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;

  } catch (error) {
    console.error('Bots API error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to process bot data request',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/bots
 * Create a new bot for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required', message: 'Must be signed in to create bots' },
        { status: 401 }
      );
    }

    // Check for alpha access via query parameter or header
    const searchParams = request.nextUrl.searchParams;
    const alphaParam = searchParams.get('alpha');
    const alphaHeader = request.headers.get('x-alpha-access');
    const hasAlphaAccess = alphaParam === 'true' || alphaHeader === 'true';

    if (!hasAlphaAccess) {
      return NextResponse.json(
        { 
          error: 'Feature not available', 
          message: 'Bot creation is currently in alpha. Please contact support for access.',
          code: 'ALPHA_ACCESS_REQUIRED'
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = CreateBotRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const bot = await botService.createBotByClerkUserId(userId, validation.data);

    return NextResponse.json({
      bot,
      message: 'Bot created successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Create bot API error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to create bot',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/bots
 * Update a bot for the authenticated user
 * Query params:
 * - botId: ID of the bot to update
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required', message: 'Must be signed in to update bots' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const botId = searchParams.get('botId');

    if (!botId) {
      return NextResponse.json(
        { error: 'Bad request', message: 'botId parameter is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = BotSchema.partial().safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const bot = await botService.updateBotByClerkUserId(userId, botId, validation.data);

    return NextResponse.json({
      bot,
      message: 'Bot updated successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Update bot API error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to update bot',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/bots
 * Delete a bot for the authenticated user
 * Query params:
 * - botId: ID of the bot to delete
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required', message: 'Must be signed in to delete bots' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const botId = searchParams.get('botId');

    if (!botId) {
      return NextResponse.json(
        { error: 'Bad request', message: 'botId parameter is required' },
        { status: 400 }
      );
    }

    await botService.deleteBotByClerkUserId(userId, botId);

    return NextResponse.json({
      message: 'Bot deleted successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Delete bot API error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to delete bot',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}