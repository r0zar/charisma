/**
 * Redis storage layer for activity timeline
 * Follows existing KV patterns from orders, swaps, and other systems
 */

import { kv } from '@vercel/kv';
import { ActivityItem, ActivityFeedOptions, ActivityFeedResult, Reply } from './types';

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
    // Store in main hash (follows orders/swaps pattern)
    await kv.hset(ACTIVITY_HASH_KEY, { [activity.id]: JSON.stringify(activity) });
    
    // Add to time-based sorted set for efficient chronological queries
    await kv.zadd(ACTIVITY_TIMELINE_SORTED, { 
      score: activity.timestamp, 
      member: activity.id 
    });
    
    // Add to user-specific sorted set
    await kv.zadd(`${USER_TIMELINE_SORTED}${activity.owner}`, {
      score: activity.timestamp,
      member: activity.id
    });
    
    // Add to indexing sets for filtering
    await kv.sadd(`${USER_ACTIVITIES_SET}${activity.owner}`, activity.id);
    await kv.sadd(`${TYPE_ACTIVITIES_SET}${activity.type}`, activity.id);
    await kv.sadd(`${STATUS_ACTIVITIES_SET}${activity.status}`, activity.id);
    
  } catch (error) {
    console.error('Error adding activity to storage:', error);
    throw error;
  }
}

/**
 * Update existing activity
 */
export async function updateActivity(activityId: string, updates: Partial<ActivityItem>): Promise<void> {
  try {
    // Get existing activity
    const existingData = await kv.hget(ACTIVITY_HASH_KEY, activityId);
    if (!existingData) {
      throw new Error(`Activity ${activityId} not found`);
    }
    
    const existing = JSON.parse(existingData as string) as ActivityItem;
    const updated = { ...existing, ...updates };
    
    // Update main hash
    await kv.hset(ACTIVITY_HASH_KEY, { [activityId]: JSON.stringify(updated) });
    
    // Update indexes if relevant fields changed
    if (updates.status && updates.status !== existing.status) {
      // Remove from old status set, add to new
      await kv.srem(`${STATUS_ACTIVITIES_SET}${existing.status}`, activityId);
      await kv.sadd(`${STATUS_ACTIVITIES_SET}${updated.status}`, activityId);
    }
    
  } catch (error) {
    console.error('Error updating activity:', error);
    throw error;
  }
}

/**
 * Get activity timeline with pagination and filtering
 * Follows existing pagination patterns from orders/swaps
 */
export async function getActivityTimeline(options: ActivityFeedOptions = {}): Promise<ActivityFeedResult> {
  try {
    const { 
      limit = 50, 
      offset = 0, 
      sortOrder = 'desc',
      types,
      statuses,
      searchQuery,
      dateRange
    } = options;
    
    let activityIds: string[];
    
    // Use sorted set for efficient time-based pagination (like price data)
    const timelineKey = ACTIVITY_TIMELINE_SORTED;
    
    if (dateRange) {
      // Query by time range using sorted set
      activityIds = await kv.zrange(
        timelineKey, 
        dateRange.start, 
        dateRange.end, 
        { byScore: true }
      ) as string[];
    } else {
      // Get most recent activities
      const start = sortOrder === 'desc' ? -(offset + limit) : offset;
      const end = sortOrder === 'desc' ? -(offset + 1) : offset + limit - 1;
      
      activityIds = await kv.zrange(timelineKey, start, end, {
        rev: sortOrder === 'desc'
      }) as string[];
    }
    
    if (activityIds.length === 0) {
      return { activities: [], total: 0, hasMore: false };
    }
    
    // Bulk fetch activity data using pipeline (like existing bulk operations)
    const pipeline = kv.pipeline();
    if (pipeline) {
      activityIds.forEach(id => pipeline.hget(ACTIVITY_HASH_KEY, id));
      const results = await pipeline.exec();
      
      const activities: ActivityItem[] = results
        .map((result, index) => {
          if (result && result[1]) {
            try {
              return JSON.parse(result[1] as string) as ActivityItem;
            } catch (error) {
              console.error(`Error parsing activity ${activityIds[index]}:`, error);
              return null;
            }
          }
          return null;
        })
        .filter((activity): activity is ActivityItem => activity !== null);
      
      // Apply additional filters in memory (follows existing pattern)
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
      
      // Get total count for pagination
      const totalCount = await kv.zcard(timelineKey);
      const hasMore = offset + limit < totalCount;
      
      return {
        activities: filtered,
        total: totalCount,
        hasMore
      };
      
    } else {
      // Fallback for no pipeline support (like existing fallbacks)
      const promises = activityIds.map(id => kv.hget(ACTIVITY_HASH_KEY, id));
      const results = await Promise.all(promises);
      
      const activities: ActivityItem[] = results
        .map((result, index) => {
          if (result) {
            try {
              return JSON.parse(result as string) as ActivityItem;
            } catch (error) {
              console.error(`Error parsing activity ${activityIds[index]}:`, error);
              return null;
            }
          }
          return null;
        })
        .filter((activity): activity is ActivityItem => activity !== null);
      
      const totalCount = await kv.zcard(timelineKey);
      
      return {
        activities,
        total: totalCount,
        hasMore: offset + limit < totalCount
      };
    }
    
  } catch (error) {
    console.error('Error getting activity timeline:', error);
    throw error;
  }
}

/**
 * Get activities for specific user
 */
export async function getUserActivityTimeline(
  userAddress: string, 
  options: Omit<ActivityFeedOptions, 'owner'> = {}
): Promise<ActivityFeedResult> {
  const { limit = 50, offset = 0, sortOrder = 'desc' } = options;
  
  try {
    const userTimelineKey = `${USER_TIMELINE_SORTED}${userAddress}`;
    
    const start = sortOrder === 'desc' ? -(offset + limit) : offset;
    const end = sortOrder === 'desc' ? -(offset + 1) : offset + limit - 1;
    
    const activityIds = await kv.zrange(userTimelineKey, start, end, {
      rev: sortOrder === 'desc'
    }) as string[];
    
    if (activityIds.length === 0) {
      return { activities: [], total: 0, hasMore: false };
    }
    
    // Bulk fetch activities
    const pipeline = kv.pipeline();
    if (pipeline) {
      activityIds.forEach(id => pipeline.hget(ACTIVITY_HASH_KEY, id));
      const results = await pipeline.exec();
      
      const activities: ActivityItem[] = results
        .map((result) => {
          if (result && result[1]) {
            try {
              return JSON.parse(result[1] as string) as ActivityItem;
            } catch (error) {
              console.error('Error parsing user activity:', error);
              return null;
            }
          }
          return null;
        })
        .filter((activity): activity is ActivityItem => activity !== null);
      
      const totalCount = await kv.zcard(userTimelineKey);
      
      return {
        activities,
        total: totalCount,
        hasMore: offset + limit < totalCount
      };
    }
    
    return { activities: [], total: 0, hasMore: false };
    
  } catch (error) {
    console.error('Error getting user activity timeline:', error);
    throw error;
  }
}

/**
 * Add reply to activity
 */
export async function addReply(reply: Reply): Promise<void> {
  try {
    // Store reply in hash
    await kv.hset(REPLY_HASH_KEY, { [reply.id]: JSON.stringify(reply) });
    
    // Add to activity's reply set
    await kv.sadd(`${ACTIVITY_REPLIES_SET}${reply.activityId}`, reply.id);
    
    // Update activity's reply count
    const activityData = await kv.hget(ACTIVITY_HASH_KEY, reply.activityId);
    if (activityData) {
      const activity = JSON.parse(activityData as string) as ActivityItem;
      const replyCount = await kv.scard(`${ACTIVITY_REPLIES_SET}${reply.activityId}`);
      
      const updatedActivity = {
        ...activity,
        replyCount,
        hasReplies: replyCount > 0
      };
      
      await kv.hset(ACTIVITY_HASH_KEY, { 
        [reply.activityId]: JSON.stringify(updatedActivity) 
      });
    }
    
  } catch (error) {
    console.error('Error adding reply:', error);
    throw error;
  }
}

/**
 * Get replies for activity
 */
export async function getActivityReplies(activityId: string): Promise<Reply[]> {
  try {
    const replyIds = await kv.smembers(`${ACTIVITY_REPLIES_SET}${activityId}`);
    
    if (replyIds.length === 0) {
      return [];
    }
    
    // Bulk fetch replies
    const pipeline = kv.pipeline();
    if (pipeline) {
      replyIds.forEach(id => pipeline.hget(REPLY_HASH_KEY, id));
      const results = await pipeline.exec();
      
      const replies: Reply[] = results
        .map((result) => {
          if (result && result[1]) {
            try {
              return JSON.parse(result[1] as string) as Reply;
            } catch (error) {
              console.error('Error parsing reply:', error);
              return null;
            }
          }
          return null;
        })
        .filter((reply): reply is Reply => reply !== null)
        .sort((a, b) => a.timestamp - b.timestamp); // Chronological order
      
      return replies;
    }
    
    return [];
    
  } catch (error) {
    console.error('Error getting activity replies:', error);
    throw error;
  }
}

/**
 * Delete activity (cleanup all indexes)
 */
export async function deleteActivity(activityId: string): Promise<void> {
  try {
    // Get activity data first
    const activityData = await kv.hget(ACTIVITY_HASH_KEY, activityId);
    if (!activityData) return;
    
    const activity = JSON.parse(activityData as string) as ActivityItem;
    
    // Remove from all indexes
    await Promise.all([
      kv.hdel(ACTIVITY_HASH_KEY, activityId),
      kv.zrem(ACTIVITY_TIMELINE_SORTED, activityId),
      kv.zrem(`${USER_TIMELINE_SORTED}${activity.owner}`, activityId),
      kv.srem(`${USER_ACTIVITIES_SET}${activity.owner}`, activityId),
      kv.srem(`${TYPE_ACTIVITIES_SET}${activity.type}`, activityId),
      kv.srem(`${STATUS_ACTIVITIES_SET}${activity.status}`, activityId)
    ]);
    
  } catch (error) {
    console.error('Error deleting activity:', error);
    throw error;
  }
}

/**
 * Get activity statistics
 */
export async function getActivityStats(): Promise<{
  totalActivities: number;
  totalUsers: number;
  activitiesByType: Record<string, number>;
  activitiesByStatus: Record<string, number>;
}> {
  try {
    const totalActivities = await kv.hlen(ACTIVITY_HASH_KEY);
    const totalUsers = await kv.scan(0, { match: `${USER_ACTIVITIES_SET}*`, count: 1000 });
    
    // This would need more sophisticated aggregation for production
    return {
      totalActivities,
      totalUsers: totalUsers[1].length,
      activitiesByType: {},
      activitiesByStatus: {}
    };
    
  } catch (error) {
    console.error('Error getting activity stats:', error);
    throw error;
  }
}