import { NextRequest, NextResponse } from 'next/server';
import { appState } from '@/data/app-state';
import { defaultState } from '@/data/default-state';
import { notificationStore, isKVAvailable } from '@/lib/infrastructure/storage';
import { isFeatureEnabled } from '@/lib/infrastructure/config/feature-flags';

/**
 * GET /api/v1/notifications
 * Returns notifications data from KV store for a specific user
 * Query params:
 * - userId: User ID (required)
 * - default: 'true' to use default state
 * - unread: 'true' to get only unread notifications
 * - type: filter by notification type (success, error, warning, info)
 * - category: filter by notification category
 * - priority: filter by priority (high, medium, low)
 * - limit: limit number of results
 * - offset: offset for pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const useDefault = searchParams.get('default') === 'true';
    const unreadOnly = searchParams.get('unread') === 'true';
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;
    
    // Check if notifications API is enabled
    if (!isFeatureEnabled('enableApiNotifications')) {
      return NextResponse.json(
        { 
          error: 'Notifications API not enabled',
          message: 'Notifications API feature is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // For multi-user KV store, userId is required
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Missing userId',
          message: 'userId parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check if we should use KV store
    const useKV = await isKVAvailable();
    
    let responseData;
    
    if (useKV) {
      // Use KV store only
      const filters = {
        type: type || undefined,
        category: category || undefined,
        read: unreadOnly ? false : undefined,
        priority: priority || undefined,
        limit,
        offset,
      };
      
      const result = await notificationStore.getNotifications(userId, filters);
      const counts = await notificationStore.getNotificationCounts(userId);
      
      responseData = {
        notifications: result.notifications,
        pagination: {
          offset,
          limit,
          total: result.total,
          hasMore: result.hasMore,
        },
        filters: {
          unreadOnly,
          type,
          category,
          priority,
        },
        summary: {
          total: counts.total,
          unread: counts.unread,
          byType: counts.byType,
          byPriority: counts.byPriority,
        },
        source: 'kv',
        timestamp: new Date().toISOString(),
      };
    } else {
      // Return empty data when KV is not enabled - no fallback to static data
      responseData = {
        notifications: [],
        pagination: {
          offset: 0,
          limit: 50,
          total: 0,
          hasMore: false,
        },
        filters: {
          unreadOnly,
          type,
          category,
          priority,
        },
        summary: {
          total: 0,
          unread: 0,
          byType: {},
          byPriority: {},
        },
        source: 'disabled',
        timestamp: new Date().toISOString(),
      };
    }

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': useKV ? 'private, s-maxage=10, stale-while-revalidate=60' : 'private, s-maxage=30, stale-while-revalidate=120',
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
 * Create new notification in KV store for a specific user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    // Check if notifications API is enabled
    if (!isFeatureEnabled('enableApiNotifications')) {
      return NextResponse.json(
        { 
          error: 'Notifications API not enabled',
          message: 'Notifications API feature is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // For multi-user KV store, userId is required
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Missing userId',
          message: 'userId parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check if we should use KV store
    const useKV = await isKVAvailable();
    
    if (!useKV) {
      return NextResponse.json(
        { 
          error: 'KV store not available',
          message: 'Notification creation requires KV store to be enabled and available',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    // Validate required fields
    const { type, title, message, priority = 'medium', category = 'general', metadata = {} } = body;
    
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
    
    // Create notification
    const notification = await notificationStore.createNotification(userId, {
      type,
      title,
      message,
      priority,
      category,
      metadata,
      timestamp: new Date().toISOString(),
      read: false,
    });
    
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
    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const notificationId = searchParams.get('id');
    const action = searchParams.get('action'); // 'read', 'unread', 'update', 'mark-all-read'
    
    // Check if notifications API is enabled
    if (!isFeatureEnabled('enableApiNotifications')) {
      return NextResponse.json(
        { 
          error: 'Notifications API not enabled',
          message: 'Notifications API feature is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // For multi-user KV store, userId is required
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Missing userId',
          message: 'userId parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check if we should use KV store
    const useKV = await isKVAvailable();
    
    if (!useKV) {
      return NextResponse.json(
        { 
          error: 'KV store not available',
          message: 'Notification updates require KV store to be enabled and available',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    // Handle mark all as read
    if (action === 'mark-all-read') {
      const success = await notificationStore.markAllAsRead(userId);
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
      const success = await notificationStore.markAsRead(userId, notificationId);
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
      const success = await notificationStore.markAsUnread(userId, notificationId);
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
    
    // Handle general updates
    if (action === 'update' || !action) {
      const updatedNotification = await notificationStore.updateNotification(userId, notificationId, body);
      if (updatedNotification) {
        return NextResponse.json({
          notification: updatedNotification,
          message: 'Notification updated successfully',
          timestamp: new Date().toISOString(),
        });
      } else {
        return NextResponse.json(
          {
            error: 'Failed to update notification',
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
        message: 'action must be one of: read, unread, update, mark-all-read',
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
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const notificationId = searchParams.get('id');
    const action = searchParams.get('action'); // 'clear-all'
    
    // Check if notifications API is enabled
    if (!isFeatureEnabled('enableApiNotifications')) {
      return NextResponse.json(
        { 
          error: 'Notifications API not enabled',
          message: 'Notifications API feature is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // For multi-user KV store, userId is required
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Missing userId',
          message: 'userId parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check if we should use KV store
    const useKV = await isKVAvailable();
    
    if (!useKV) {
      return NextResponse.json(
        { 
          error: 'KV store not available',
          message: 'Notification deletion requires KV store to be enabled and available',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    // Handle clear all notifications
    if (action === 'clear-all') {
      const success = await notificationStore.clearAll(userId);
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
    const success = await notificationStore.deleteNotification(userId, notificationId);
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