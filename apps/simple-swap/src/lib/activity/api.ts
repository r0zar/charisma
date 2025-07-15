/**
 * Activity API client
 * Fetches activities from tx-monitor service
 */

import { ActivityItem, ActivityFeedOptions, ActivityFeedResult, Reply } from './types';

// Use tx-monitor service for activities
const TX_MONITOR_URL = process.env.NEXT_PUBLIC_TX_MONITOR_URL || 'http://localhost:3012';
const API_BASE = `${TX_MONITOR_URL}/api/v1/activities`;

/**
 * Fetch activity timeline from API
 */
export async function fetchActivityTimeline(options: ActivityFeedOptions = {}): Promise<ActivityFeedResult> {
  try {
    const params = new URLSearchParams();
    
    // Add pagination params
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('page', Math.floor((options.offset || 0) / (options.limit || 50) + 1).toString());
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);
    
    // Add filter params
    if (options.types) params.append('types', options.types.join(','));
    if (options.statuses) params.append('statuses', options.statuses.join(','));
    if (options.searchQuery) params.append('search', options.searchQuery);
    
    // Add date range
    if (options.dateRange) {
      params.append('startDate', new Date(options.dateRange.start).toISOString());
      params.append('endDate', new Date(options.dateRange.end).toISOString());
    }
    
    const response = await fetch(`${API_BASE}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      activities: data.data || [],
      total: data.pagination?.total || 0,
      hasMore: data.pagination?.hasMore || false
    };
    
  } catch (error) {
    console.error('Error fetching activity timeline:', error);
    throw error;
  }
}

/**
 * Fetch user-specific activity timeline
 */
export async function fetchUserActivityTimeline(
  userAddress: string, 
  options: Omit<ActivityFeedOptions, 'owner'> = {}
): Promise<ActivityFeedResult> {
  try {
    const params = new URLSearchParams();
    
    // Add user filter
    params.append('owner', userAddress);
    
    // Add other options
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('page', Math.floor((options.offset || 0) / (options.limit || 50) + 1).toString());
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);
    
    const response = await fetch(`${API_BASE}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      activities: data.data || [],
      total: data.pagination?.total || 0,
      hasMore: data.pagination?.hasMore || false
    };
    
  } catch (error) {
    console.error('Error fetching user activity timeline:', error);
    throw error;
  }
}

/**
 * Fetch replies for an activity
 */
export async function fetchActivityReplies(activityId: string): Promise<Reply[]> {
  try {
    const response = await fetch(`${API_BASE}/${activityId}/replies`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data || [];
    
  } catch (error) {
    console.error('Error fetching activity replies:', error);
    throw error;
  }
}

/**
 * Add reply to an activity
 */
export async function addActivityReply(
  activityId: string, 
  content: string, 
  author: string
): Promise<Reply> {
  try {
    const response = await fetch(`${API_BASE}/${activityId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        author
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data;
    
  } catch (error) {
    console.error('Error adding activity reply:', error);
    throw error;
  }
}

/**
 * Update reply
 */
export async function updateActivityReply(
  activityId: string,
  replyId: string,
  content: string,
  author: string
): Promise<Reply> {
  try {
    const response = await fetch(`${API_BASE}/${activityId}/replies/${replyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        author
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data;
    
  } catch (error) {
    console.error('Error updating activity reply:', error);
    throw error;
  }
}

/**
 * Delete reply
 */
export async function deleteActivityReply(
  activityId: string,
  replyId: string
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/${activityId}/replies/${replyId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('Error deleting activity reply:', error);
    throw error;
  }
}

/**
 * Trigger manual ingestion (admin function)
 */
export async function triggerIngestion(type: 'full' | 'incremental' | 'cleanup', options?: any): Promise<any> {
  try {
    const response = await fetch(`${API_BASE}/admin/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: type,
        ...options
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Error triggering ingestion:', error);
    throw error;
  }
}

/**
 * Get activity stats (admin function)
 */
export async function getActivityStats(): Promise<any> {
  try {
    const response = await fetch(`${API_BASE}/admin/ingest`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Error getting activity stats:', error);
    throw error;
  }
}

/**
 * Hook for using activity timeline in React components
 */
export function useActivityTimeline(options: ActivityFeedOptions = {}) {
  const [activities, setActivities] = React.useState<ActivityItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  
  const loadActivities = async (resetData = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await fetchActivityTimeline(options);
      
      if (resetData) {
        setActivities(result.activities);
      } else {
        setActivities(prev => [...prev, ...result.activities]);
      }
      
      setHasMore(result.hasMore);
      setTotal(result.total);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities');
      console.error('Error loading activities:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const refresh = () => loadActivities(true);
  const loadMore = () => {
    if (!loading && hasMore) {
      loadActivities(false);
    }
  };
  
  React.useEffect(() => {
    loadActivities(true);
  }, [JSON.stringify(options)]);
  
  return {
    activities,
    loading,
    error,
    hasMore,
    total,
    refresh,
    loadMore
  };
}

// Import React for the hook
import React from 'react';