import { NextRequest, NextResponse } from 'next/server';
import { botDataStore, isKVAvailable } from '@/lib/kv-store';
import { config } from '@/lib/config';
import { verifySignatureAndGetSignerWithTimestamp } from 'blaze-sdk';
import { BotActivity } from '@/types/bot';
import { z } from 'zod';
import { logger } from '@/lib/server/logger';

// Query parameters schema
const GetActivitiesSchema = z.object({
  userId: z.string().min(1),
  botId: z.string().optional(),
  type: z.enum(['yield-farming', 'deposit', 'withdrawal', 'trade', 'error']).optional(),
  status: z.enum(['pending', 'success', 'failed']).optional(),
  limit: z.string().transform(val => parseInt(val)).default('50'),
  offset: z.string().transform(val => parseInt(val)).default('0'),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

// Create activity schema
const CreateActivitySchema = z.object({
  botId: z.string().min(1),
  type: z.enum(['yield-farming', 'deposit', 'withdrawal', 'trade', 'error']),
  status: z.enum(['pending', 'success', 'failed']),
  description: z.string().min(1),
  txid: z.string().optional(),
  amount: z.number().optional(),
  token: z.string().optional(),
  error: z.string().optional(),
  blockHeight: z.number().optional(),
  blockTime: z.string().optional()
});

/**
 * GET /api/v1/activities
 * Get bot activities with filtering and pagination
 * Query params:
 * - userId: user ID that owns the activities (required)
 * - botId: filter by specific bot ID (optional)
 * - type: filter by activity type (optional)
 * - status: filter by activity status (optional)
 * - limit: number of activities to return (default: 50)
 * - offset: number of activities to skip (default: 0)
 * - startDate: filter activities after this date (optional)
 * - endDate: filter activities before this date (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const validationResult = GetActivitiesSchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          message: validationResult.error.errors.map(e => e.message).join(', '),
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { userId, botId, type, status, limit, offset, startDate, endDate } = validationResult.data;

    // Check if bot API is enabled
    if (!config.enableAPIBots) {
      return NextResponse.json(
        {
          error: 'Bot API disabled',
          message: 'Bot activities API is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Check KV availability
    const kvAvailable = await isKVAvailable();
    if (!kvAvailable) {
      return NextResponse.json(
        {
          error: 'KV store unavailable',
          message: 'Activity data storage is temporarily unavailable',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Note: Authentication disabled for reading user data to prevent infinite loops
    // Frontend pages are responsible for only requesting data for connected wallet
    logger.info(`📊 Activities request for user: ${userId.slice(0, 8)}...`);

    // Get activities from KV store
    const activities = await botDataStore.getAllActivities(userId);

    // Apply filters
    let filteredActivities = activities;

    if (botId) {
      filteredActivities = filteredActivities.filter(activity => activity.botId === botId);
    }

    if (type) {
      filteredActivities = filteredActivities.filter(activity => activity.type === type);
    }

    if (status) {
      filteredActivities = filteredActivities.filter(activity => activity.status === status);
    }

    if (startDate) {
      const start = new Date(startDate);
      filteredActivities = filteredActivities.filter(activity => 
        new Date(activity.timestamp) >= start
      );
    }

    if (endDate) {
      const end = new Date(endDate);
      filteredActivities = filteredActivities.filter(activity => 
        new Date(activity.timestamp) <= end
      );
    }

    // Sort by timestamp (newest first)
    filteredActivities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply pagination
    const paginatedActivities = filteredActivities.slice(offset, offset + limit);

    // Get total count for pagination metadata
    const totalCount = filteredActivities.length;
    const hasMore = offset + limit < totalCount;

    return NextResponse.json(
      {
        success: true,
        activities: paginatedActivities,
        pagination: {
          limit,
          offset,
          total: totalCount,
          hasMore,
          nextOffset: hasMore ? offset + limit : null
        },
        filters: {
          userId,
          botId,
          type,
          status,
          startDate,
          endDate
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch activities',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/activities
 * Create a new bot activity
 * Query params:
 * - userId: user ID that owns the bot (required)
 * Body: Activity data (botId, type, status, description, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const useDefault = searchParams.get('default') === 'true';

    if (!userId && !useDefault) {
      return NextResponse.json(
        {
          error: 'Missing userId',
          message: 'userId query parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check for signature-based authentication
    const hasSignatureHeaders = request.headers.get('x-signature') && 
                                request.headers.get('x-public-key') && 
                                request.headers.get('x-timestamp');

    if (hasSignatureHeaders && userId) {
      const baseMessage = `create_activity_${Date.now()}`;
      
      const verificationResult = await verifySignatureAndGetSignerWithTimestamp(request, {
        message: baseMessage,
        ttl: 5 // 5 minute window
      });

      if (!verificationResult.ok) {
        return NextResponse.json(
          {
            error: 'Authentication failed',
            message: verificationResult.error,
            timestamp: new Date().toISOString(),
          },
          { status: verificationResult.status }
        );
      }

      if (verificationResult.signer !== userId) {
        return NextResponse.json(
          {
            error: 'Unauthorized',
            message: 'Signature does not match the provided user ID',
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        );
      }

      console.log(`[ActivityAPI] Authenticated request from ${verificationResult.signer}`);
    } else if (!useDefault) {
      console.warn(`[ActivityAPI] Unauthenticated activity creation request from user ${userId}`);
    }

    // Check if bot API is enabled
    if (!config.enableAPIBots) {
      return NextResponse.json(
        {
          error: 'Bot API disabled',
          message: 'Bot activities management is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = CreateActivitySchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid activity data',
          message: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const activityData = validationResult.data;

    // Handle mock mode
    if (useDefault || !config.enableAPIBots) {
      const mockActivity: BotActivity = {
        id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        ...activityData
      };

      return NextResponse.json(
        {
          success: true,
          message: 'Activity created (mock mode)',
          activity: mockActivity,
          timestamp: new Date().toISOString(),
        },
        { status: 201 }
      );
    }

    // Check KV availability
    const kvAvailable = await isKVAvailable();
    if (!kvAvailable) {
      return NextResponse.json(
        {
          error: 'KV store unavailable',
          message: 'Activity data storage is temporarily unavailable',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Verify bot exists and belongs to user
    const bot = await botDataStore.getBot(userId!, activityData.botId);
    if (!bot) {
      return NextResponse.json(
        {
          error: 'Bot not found',
          message: `Bot ${activityData.botId} not found for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Create activity
    const newActivity: BotActivity = {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...activityData
    };

    // Store activity in KV
    await botDataStore.addBotActivity(userId!, newActivity);

    console.log(`[ActivityAPI] Created activity ${newActivity.id} for bot ${activityData.botId}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Activity created successfully',
        activity: newActivity,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json(
      {
        error: 'Failed to create activity',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}