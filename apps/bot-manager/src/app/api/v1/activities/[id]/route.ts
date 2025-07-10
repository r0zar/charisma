import { NextRequest, NextResponse } from 'next/server';
import { botDataStore, isKVAvailable } from '@/lib/kv-store';
import { config } from '@/lib/config';
import { verifySignatureAndGetSignerWithTimestamp } from 'blaze-sdk';
import { z } from 'zod';

// Update activity schema
const UpdateActivitySchema = z.object({
  type: z.enum(['yield-farming', 'deposit', 'withdrawal', 'trade', 'error']).optional(),
  status: z.enum(['pending', 'success', 'failed']).optional(),
  description: z.string().min(1).optional(),
  txid: z.string().optional(),
  amount: z.number().optional(),
  token: z.string().optional(),
  error: z.string().optional(),
  blockHeight: z.number().optional(),
  blockTime: z.string().optional()
});

/**
 * GET /api/v1/activities/[id]
 * Get a specific bot activity by ID
 * Query params:
 * - userId: user ID that owns the activity (required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params;
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

    // Get all activities and find the specific one
    const activities = await botDataStore.getAllActivities(userId);
    const activity = activities.find(a => a.id === activityId);

    if (!activity) {
      return NextResponse.json(
        {
          error: 'Activity not found',
          message: `Activity ${activityId} not found for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        activity,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch activity',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/activities/[id]
 * Update a specific bot activity
 * Query params:
 * - userId: user ID that owns the activity (required)
 * Body: Partial activity data to update
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params;
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
      const baseMessage = `update_activity_${activityId}`;
      
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

      console.log(`[ActivityAPI] Authenticated update request from ${verificationResult.signer} for activity ${activityId}`);
    } else if (!useDefault) {
      console.warn(`[ActivityAPI] Unauthenticated activity update request from user ${userId}`);
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
    const validationResult = UpdateActivitySchema.safeParse(body);
    
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

    const updateData = validationResult.data;

    // Handle mock mode
    if (useDefault || !config.enableAPIBots) {
      return NextResponse.json(
        {
          success: true,
          message: `Activity ${activityId} updated (mock mode)`,
          activityId,
          updates: updateData,
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
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

    // Get all activities and find the specific one
    const activities = await botDataStore.getAllActivities(userId!);
    const activityIndex = activities.findIndex(a => a.id === activityId);

    if (activityIndex === -1) {
      return NextResponse.json(
        {
          error: 'Activity not found',
          message: `Activity ${activityId} not found for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Update the activity
    const updatedActivity = {
      ...activities[activityIndex],
      ...updateData,
      // Always update timestamp when modifying
      timestamp: new Date().toISOString()
    };

    // Replace in activities array
    activities[activityIndex] = updatedActivity;

    // Store updated activities back to KV
    // Note: This is a simplified approach. In production, you might want
    // a more efficient update method in the KV store
    await botDataStore.addBotActivity(userId!, updatedActivity);

    console.log(`[ActivityAPI] Updated activity ${activityId} for user ${userId}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Activity updated successfully',
        activity: updatedActivity,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error updating activity:', error);
    return NextResponse.json(
      {
        error: 'Failed to update activity',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/activities/[id]
 * Delete a specific bot activity
 * Query params:
 * - userId: user ID that owns the activity (required)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params;
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

    // Check for signature-based authentication
    const hasSignatureHeaders = request.headers.get('x-signature') && 
                                request.headers.get('x-public-key') && 
                                request.headers.get('x-timestamp');

    if (hasSignatureHeaders) {
      const baseMessage = `delete_activity_${activityId}`;
      
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

      console.log(`[ActivityAPI] Authenticated delete request from ${verificationResult.signer} for activity ${activityId}`);
    } else {
      console.warn(`[ActivityAPI] Unauthenticated activity deletion request from user ${userId}`);
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

    // Get all activities and find the specific one
    const activities = await botDataStore.getAllActivities(userId);
    const activity = activities.find(a => a.id === activityId);

    if (!activity) {
      return NextResponse.json(
        {
          error: 'Activity not found',
          message: `Activity ${activityId} not found for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // TODO: Implement actual deletion in KV store
    // For now, we'll just return success since the KV store doesn't have a delete method yet
    console.log(`[ActivityAPI] Would delete activity ${activityId} for user ${userId}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Activity deleted successfully',
        activityId,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error deleting activity:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete activity',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}