import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { CreateNotificationData,NotificationFilters, notificationService } from '@/lib/services/notifications/service';

/**
 * GET /api/v1/notifications
 * Returns notifications data for a specific user
 * Query params:
 * - userId: User ID (required)
 * - unread: 'true' to get only unread notifications
 * - type: filter by notification type (success, error, warning, info)
 * - category: filter by notification category
 * - priority: filter by priority (high, medium, low)
 * - limit: limit number of results
 * - offset: offset for pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication via Clerk
    const { userId } = await auth();
    
    if (!userId) {
      console.warn(`❌ Unauthenticated notifications request`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'User must be authenticated to access notifications',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get('unread') === 'true';
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    console.log(`📫 Authenticated notifications request from user ${userId}`);

    // Build filters
    const filters: NotificationFilters = {
      type: type as 'success' | 'error' | 'warning' | 'info' || undefined,
      category: category || undefined,
      unread: unreadOnly ? true : undefined,
      priority: priority as 'high' | 'medium' | 'low' || undefined,
      limit,
      offset,
    };

    // Get notifications and summary using service
    const [notifications, summary] = await Promise.all([
      notificationService.getNotifications(userId, filters),
      notificationService.getNotificationSummary(userId)
    ]);

    // Calculate pagination
    const total = summary.total;
    const hasMore = (offset + limit) < total;

    const responseData = {
      notifications,
      pagination: {
        offset,
        limit,
        total,
        hasMore,
      },
      filters: {
        unreadOnly,
        type,
        category,
        priority,
      },
      summary,
      source: notificationService.getDataSource(),
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': notificationService.isKVEnabled() ? 'private, s-maxage=10, stale-while-revalidate=60' : 'private, s-maxage=30, stale-while-revalidate=120',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch notifications',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/notifications
 * Create new notification for a specific user
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication via Clerk
    const { userId } = await auth();
    
    if (!userId) {
      console.warn(`❌ Unauthenticated notification creation request`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'User must be authenticated to create notifications',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log(`📫 Authenticated notification creation request from user ${userId}`);

    // Check if notification creation is available
    if (!notificationService.isKVEnabled()) {
      return NextResponse.json(
        {
          error: 'Notification creation disabled',
          message: 'Notification creation requires KV store to be enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Validate required fields
    const { type, title, message, priority = 'medium', category = 'general', metadata = {}, persistent = false, actionUrl } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'type, title, and message are required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Validate field values
    if (!['success', 'error', 'warning', 'info'].includes(type)) {
      return NextResponse.json(
        {
          error: 'Invalid notification type',
          message: 'type must be one of: success, error, warning, info',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!['high', 'medium', 'low'].includes(priority)) {
      return NextResponse.json(
        {
          error: 'Invalid priority',
          message: 'priority must be one of: high, medium, low',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Create notification using service
    const notificationData: CreateNotificationData = {
      type,
      title,
      message,
      priority,
      category,
      metadata,
      persistent,
      actionUrl,
    };

    const notification = await notificationService.createNotification(userId, notificationData);

    return NextResponse.json({
      notification,
      message: 'Notification created successfully',
      timestamp: new Date().toISOString(),
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      {
        error: 'Failed to create notification',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/notifications
 * Update notification (mark as read, etc.) for a specific user
 */
export async function PATCH(request: NextRequest) {
  try {
    // Verify authentication via Clerk
    const { userId } = await auth();
    
    if (!userId) {
      console.warn(`❌ Unauthenticated notification update request`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'User must be authenticated to update notifications',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const notificationId = searchParams.get('id');
    const action = searchParams.get('action'); // 'read', 'unread', 'mark-all-read'

    console.log(`📫 Authenticated notification update request from user ${userId} for action: ${action}`);

    // Check if notification updates are available
    if (!notificationService.isKVEnabled()) {
      return NextResponse.json(
        {
          error: 'Notification updates disabled',
          message: 'Notification updates require KV store to be enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Handle mark all as read
    if (action === 'mark-all-read') {
      const success = await notificationService.markAllAsRead(userId);
      if (success) {
        return NextResponse.json({
          message: 'All notifications marked as read',
          timestamp: new Date().toISOString(),
        });
      } else {
        return NextResponse.json(
          {
            error: 'Failed to mark all notifications as read',
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        );
      }
    }

    // Validate notification ID for individual updates
    if (!notificationId) {
      return NextResponse.json(
        {
          error: 'Missing notification ID',
          message: 'id parameter is required for individual notification updates',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Handle individual notification updates
    if (action === 'read') {
      const success = await notificationService.markAsRead(userId, notificationId);
      if (success) {
        return NextResponse.json({
          message: 'Notification marked as read',
          notificationId,
          timestamp: new Date().toISOString(),
        });
      } else {
        return NextResponse.json(
          {
            error: 'Failed to mark notification as read',
            message: 'Notification not found or update failed',
            notificationId,
            timestamp: new Date().toISOString(),
          },
          { status: 404 }
        );
      }
    }

    if (action === 'unread') {
      const success = await notificationService.markAsUnread(userId, notificationId);
      if (success) {
        return NextResponse.json({
          message: 'Notification marked as unread',
          notificationId,
          timestamp: new Date().toISOString(),
        });
      } else {
        return NextResponse.json(
          {
            error: 'Failed to mark notification as unread',
            message: 'Notification not found or update failed',
            notificationId,
            timestamp: new Date().toISOString(),
          },
          { status: 404 }
        );
      }
    }

    // Invalid action
    return NextResponse.json(
      {
        error: 'Invalid action',
        message: 'action must be one of: read, unread, mark-all-read',
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      {
        error: 'Failed to update notification',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/notifications
 * Delete notification or clear all notifications for a specific user
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication via Clerk
    const { userId } = await auth();
    
    if (!userId) {
      console.warn(`❌ Unauthenticated notification deletion request`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'User must be authenticated to delete notifications',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const notificationId = searchParams.get('id');
    const action = searchParams.get('action'); // 'clear-all'

    console.log(`📫 Authenticated notification deletion request from user ${userId}`);

    // Check if notification deletion is available
    if (!notificationService.isKVEnabled()) {
      return NextResponse.json(
        {
          error: 'Notification deletion disabled',
          message: 'Notification deletion requires KV store to be enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Handle clear all notifications
    if (action === 'clear-all') {
      const success = await notificationService.clearAllNotifications(userId);
      if (success) {
        return NextResponse.json({
          message: 'All notifications cleared',
          timestamp: new Date().toISOString(),
        });
      } else {
        return NextResponse.json(
          {
            error: 'Failed to clear all notifications',
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        );
      }
    }

    // Validate notification ID for individual deletion
    if (!notificationId) {
      return NextResponse.json(
        {
          error: 'Missing notification ID',
          message: 'id parameter is required for individual notification deletion',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Delete individual notification
    const success = await notificationService.deleteNotification(userId, notificationId);
    if (success) {
      return NextResponse.json({
        message: 'Notification deleted successfully',
        notificationId,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        {
          error: 'Failed to delete notification',
          message: 'Notification not found or deletion failed',
          notificationId,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete notification',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}