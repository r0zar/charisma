/**
 * Redis storage layer for activity timeline
 * Manages activity storage directly in tx-monitor service
 */

import { kv } from '@vercel/kv';
import { ActivityItem, ActivityFeedOptions, ActivityFeedResult, ActivityUpdate, Reply } from './activity-types';
import { validateActivityForProduction } from './activity-validation';

// Storage keys following existing patterns
const ACTIVITY_HASH_KEY = 'activity_timeline';
const ACTIVITY_TIMELINE_SORTED = 'activity_timeline:by_time';
const USER_TIMELINE_SORTED = 'user_timeline:';
const USER_ACTIVITIES_SET = 'user_activities:';
const TYPE_ACTIVITIES_SET = 'type_activities:';
const STATUS_ACTIVITIES_SET = 'status_activities:';

// Reply storage keys
const REPLY_HASH_KEY = 'activity_replies';
const ACTIVITY_REPLIES_SET = 'activity_replies:';

/**
 * Add activity to timeline storage
 */
export async function addActivity(activity: ActivityItem): Promise<void> {
  try {
    // Validate activity is not a test activity in production
    validateActivityForProduction(activity);
    
    // Store in main hash (follows orders/swaps pattern)
    await kv.hset(ACTIVITY_HASH_KEY, { [activity.id]: JSON.stringify(activity) });
    
    // Add to time-based sorted set for efficient chronological queries
    await kv.zadd(ACTIVITY_TIMELINE_SORTED, { 
      score: activity.timestamp, 
      member: activity.id 
    });
    
    // Add to user-specific timeline
    await kv.zadd(`${USER_TIMELINE_SORTED}${activity.owner}`, { 
      score: activity.timestamp, 
      member: activity.id 
    });
    
    // Add to user activities set
    await kv.sadd(`${USER_ACTIVITIES_SET}${activity.owner}`, activity.id);
    
    // Add to type-specific set
    await kv.sadd(`${TYPE_ACTIVITIES_SET}${activity.type}`, activity.id);
    
    // Add to status-specific set
    await kv.sadd(`${STATUS_ACTIVITIES_SET}${activity.status}`, activity.id);
    
    console.log(`[TX-MONITOR] Added activity: ${activity.id} (${activity.type})`);
  } catch (error) {
    console.error(`[TX-MONITOR] Error adding activity ${activity.id}:`, error);
    throw error;
  }
}

/**
 * Get activity by ID
 */
export async function getActivity(id: string): Promise<ActivityItem | null> {
  try {
    const activityData = await kv.hget(ACTIVITY_HASH_KEY, id);
    if (!activityData) return null;
    
    const activity = typeof activityData === 'string' 
      ? JSON.parse(activityData) 
      : activityData;
    
    return activity as ActivityItem;
  } catch (error) {
    console.error(`[TX-MONITOR] Error getting activity ${id}:`, error);
    return null;
  }
}

/**
 * Update activity
 */
export async function updateActivity(id: string, updates: ActivityUpdate): Promise<void> {
  try {
    const existing = await getActivity(id);
    if (!existing) {
      console.warn(`[TX-MONITOR] Cannot update non-existent activity: ${id}`);
      return;
    }
    
    // Merge updates
    const { toToken: updatedToToken, ...otherUpdates } = updates;
    const updated: ActivityItem = {
      ...existing,
      ...otherUpdates,
      ...(updatedToToken && {
        toToken: {
          ...existing.toToken,
          ...updatedToToken
        }
      }),
      metadata: {
        ...existing.metadata,
        ...updates.metadata
      }
    };
    
    // Update in main hash
    await kv.hset(ACTIVITY_HASH_KEY, { [id]: JSON.stringify(updated) });
    
    // Update status-specific sets if status changed
    if (updates.status && updates.status !== existing.status) {
      await kv.srem(`${STATUS_ACTIVITIES_SET}${existing.status}`, id);
      await kv.sadd(`${STATUS_ACTIVITIES_SET}${updates.status}`, id);
    }
    
    console.log(`[TX-MONITOR] Updated activity: ${id} (${existing.type})`);
  } catch (error) {
    console.error(`[TX-MONITOR] Error updating activity ${id}:`, error);
    throw error;
  }
}

/**
 * Get activity timeline with filtering and pagination
 */
export async function getActivityTimeline(options: ActivityFeedOptions = {}): Promise<ActivityFeedResult> {
  try {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'timestamp',
      sortOrder = 'desc',
      owner,
      types,
      statuses,
      searchQuery,
      dateRange
    } = options;
    
    // Get activity IDs from appropriate sorted set
    const timelineKey = owner ? `${USER_TIMELINE_SORTED}${owner}` : ACTIVITY_TIMELINE_SORTED;
    
    // Get IDs in reverse chronological order by default
    const activityIds = (sortOrder === 'desc' 
      ? await kv.zrange(timelineKey, offset, offset + limit - 1, { rev: true })
      : await kv.zrange(timelineKey, offset, offset + limit - 1)) as string[];
    
    if (!activityIds || activityIds.length === 0) {
      return { activities: [], total: 0, hasMore: false };
    }
    
    // Fetch activities
    const activities: ActivityItem[] = [];
    for (const id of activityIds) {
      const activity = await getActivity(id);
      if (activity) {
        activities.push(activity);
      }
    }
    
    // Apply filters
    let filtered = activities;
    
    if (types && types.length > 0) {
      filtered = filtered.filter(activity => types.includes(activity.type));
    }
    
    if (statuses && statuses.length > 0) {
      filtered = filtered.filter(activity => statuses.includes(activity.status));
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(activity =>
        activity.fromToken.symbol.toLowerCase().includes(query) ||
        activity.toToken.symbol.toLowerCase().includes(query) ||
        activity.metadata?.notes?.toLowerCase().includes(query) ||
        activity.txid?.toLowerCase().includes(query)
      );
    }
    
    if (dateRange) {
      filtered = filtered.filter(activity => 
        activity.timestamp >= dateRange.start && activity.timestamp <= dateRange.end
      );
    }
    
    // Get total count
    const totalCount = await kv.zcard(timelineKey);
    const hasMore = offset + limit < totalCount;
    
    return {
      activities: filtered,
      total: totalCount,
      hasMore
    };
    
  } catch (error) {
    console.error('[TX-MONITOR] Error getting activity timeline:', error);
    return { activities: [], total: 0, hasMore: false };
  }
}

/**
 * Get user-specific activity timeline
 */
export async function getUserActivityTimeline(owner: string, options: ActivityFeedOptions = {}): Promise<ActivityFeedResult> {
  return getActivityTimeline({ ...options, owner });
}

/**
 * Add reply to activity
 */
export async function addActivityReply(activityId: string, reply: Reply): Promise<void> {
  try {
    // Store reply in hash
    await kv.hset(REPLY_HASH_KEY, { [reply.id]: JSON.stringify(reply) });
    
    // Add to activity's reply set
    await kv.zadd(`${ACTIVITY_REPLIES_SET}${activityId}`, { 
      score: reply.timestamp, 
      member: reply.id 
    });
    
    // Update activity's reply count
    const activity = await getActivity(activityId);
    if (activity) {
      await updateActivity(activityId, {
        metadata: {
          ...activity.metadata,
          replyCount: (activity.replyCount || 0) + 1,
          hasReplies: true
        }
      });
    }
    
    console.log(`[TX-MONITOR] Added reply ${reply.id} to activity ${activityId}`);
  } catch (error) {
    console.error(`[TX-MONITOR] Error adding reply to activity ${activityId}:`, error);
    throw error;
  }
}

/**
 * Get replies for an activity
 */
export async function getActivityReplies(activityId: string): Promise<Reply[]> {
  try {
    const replyIds = await kv.zrange(`${ACTIVITY_REPLIES_SET}${activityId}`, 0, -1) as string[];
    if (!replyIds || replyIds.length === 0) return [];
    
    const replies: Reply[] = [];
    for (const id of replyIds) {
      const replyData = await kv.hget(REPLY_HASH_KEY, id);
      if (replyData) {
        const reply = typeof replyData === 'string' 
          ? JSON.parse(replyData) 
          : replyData;
        replies.push(reply as Reply);
      }
    }
    
    return replies;
  } catch (error) {
    console.error(`[TX-MONITOR] Error getting replies for activity ${activityId}:`, error);
    return [];
  }
}

/**
 * Update reply
 */
export async function updateActivityReply(replyId: string, updates: Partial<Reply>): Promise<Reply | null> {
  try {
    const replyData = await kv.hget(REPLY_HASH_KEY, replyId);
    if (!replyData) return null;
    
    const reply = typeof replyData === 'string' ? JSON.parse(replyData) : replyData;
    const updatedReply = { ...reply, ...updates };
    
    // Update in storage
    await kv.hset(REPLY_HASH_KEY, { [replyId]: JSON.stringify(updatedReply) });
    
    console.log(`[TX-MONITOR] Updated reply: ${replyId}`);
    return updatedReply;
  } catch (error) {
    console.error(`[TX-MONITOR] Error updating reply ${replyId}:`, error);
    return null;
  }
}

/**
 * Delete reply
 */
export async function deleteActivityReply(replyId: string): Promise<boolean> {
  try {
    const replyData = await kv.hget(REPLY_HASH_KEY, replyId);
    if (!replyData) return false;
    
    const reply = typeof replyData === 'string' ? JSON.parse(replyData) : replyData;
    const activityId = reply.activityId;
    
    // Remove from reply hash
    await kv.hdel(REPLY_HASH_KEY, replyId);
    
    // Remove from activity's reply set
    await kv.zrem(`${ACTIVITY_REPLIES_SET}${activityId}`, replyId);
    
    // Update activity's reply count
    const activity = await getActivity(activityId);
    if (activity) {
      await updateActivity(activityId, {
        replyCount: Math.max((activity.replyCount || 1) - 1, 0),
        hasReplies: (activity.replyCount || 1) > 1
      });
    }
    
    console.log(`[TX-MONITOR] Deleted reply: ${replyId}`);
    return true;
  } catch (error) {
    console.error(`[TX-MONITOR] Error deleting reply ${replyId}:`, error);
    return false;
  }
}

/**
 * Delete activity
 */
export async function deleteActivity(id: string): Promise<void> {
  try {
    const activity = await getActivity(id);
    if (!activity) return;
    
    // Remove from main hash
    await kv.hdel(ACTIVITY_HASH_KEY, id);
    
    // Remove from sorted sets
    await kv.zrem(ACTIVITY_TIMELINE_SORTED, id);
    await kv.zrem(`${USER_TIMELINE_SORTED}${activity.owner}`, id);
    
    // Remove from other sets
    await kv.srem(`${USER_ACTIVITIES_SET}${activity.owner}`, id);
    await kv.srem(`${TYPE_ACTIVITIES_SET}${activity.type}`, id);
    await kv.srem(`${STATUS_ACTIVITIES_SET}${activity.status}`, id);
    
    console.log(`[TX-MONITOR] Deleted activity: ${id}`);
  } catch (error) {
    console.error(`[TX-MONITOR] Error deleting activity ${id}:`, error);
    throw error;
  }
}

/**
 * Get activity statistics
 */
export async function getActivityStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  oldestActivityAge?: number;
}> {
  try {
    const total = await kv.hlen(ACTIVITY_HASH_KEY);
    
    const stats = {
      total,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      oldestActivityAge: undefined as number | undefined
    };
    
    // Get type counts
    const types = ['instant_swap', 'order_filled', 'order_cancelled', 'dca_update', 'twitter_trigger'];
    for (const type of types) {
      const count = await kv.scard(`${TYPE_ACTIVITIES_SET}${type}`);
      stats.byType[type] = count;
    }
    
    // Get status counts
    const statuses = ['completed', 'pending', 'failed', 'cancelled', 'processing'];
    for (const status of statuses) {
      const count = await kv.scard(`${STATUS_ACTIVITIES_SET}${status}`);
      stats.byStatus[status] = count;
    }
    
    // Get oldest activity timestamp
    if (total > 0) {
      const oldestActivityId = await kv.zrange(ACTIVITY_TIMELINE_SORTED, 0, 0);
      if (oldestActivityId && oldestActivityId.length > 0) {
        const oldestActivity = await getActivity(oldestActivityId[0] as string);
        if (oldestActivity) {
          stats.oldestActivityAge = Date.now() - oldestActivity.timestamp;
        }
      }
    }
    
    return stats;
  } catch (error) {
    console.error('[TX-MONITOR] Error getting activity stats:', error);
    return { total: 0, byType: {}, byStatus: {} };
  }
}