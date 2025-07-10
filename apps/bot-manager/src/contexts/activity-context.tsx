'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { BotActivity } from '@/types/bot';
import { ActivityAPIClient, ActivityFilters, CreateActivityData } from '@/lib/activity-api-client';
import { useWallet } from '@/contexts/wallet-context';
import { useNotifications } from '@/contexts/notification-context';

interface ActivityContextType {
  // State
  activities: BotActivity[];
  loading: boolean;
  error: string | null;
  
  // Pagination
  hasMore: boolean;
  totalActivities: number;
  
  // Methods
  loadActivities: (filters?: ActivityFilters) => Promise<void>;
  loadMoreActivities: () => Promise<void>;
  refreshActivities: () => Promise<void>;
  createActivity: (data: CreateActivityData) => Promise<BotActivity | null>;
  updateActivity: (activityId: string, data: Partial<CreateActivityData>) => Promise<BotActivity | null>;
  deleteActivity: (activityId: string) => Promise<boolean>;
  
  // Filters
  currentFilters: ActivityFilters;
  setFilters: (filters: ActivityFilters) => void;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

interface ActivityProviderProps {
  children: React.ReactNode;
}

export function ActivityProvider({ children }: ActivityProviderProps) {
  const { getUserId } = useWallet();
  const { showError, showSuccess } = useNotifications();
  
  // State
  const [activities, setActivities] = useState<BotActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalActivities, setTotalActivities] = useState(0);
  const [currentFilters, setCurrentFilters] = useState<ActivityFilters>({
    limit: 50,
    offset: 0
  });

  // API client (memoized to prevent recreation on every render)
  const apiClient = useMemo(() => new ActivityAPIClient(), []);

  /**
   * Load activities with optional filters
   */
  const loadActivities = useCallback(async (filters: ActivityFilters = {}) => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous') {
      console.log('[ActivityContext] No authenticated user, skipping activity load');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const mergedFilters = {
        limit: 50,
        offset: 0,
        ...filters // Don't merge with currentFilters to avoid circular dependency
      };

      const response = await apiClient.getActivities(userId, mergedFilters);
      
      setActivities(response.activities);
      setHasMore(response.pagination.hasMore);
      setTotalActivities(response.pagination.total);
      setCurrentFilters(mergedFilters);

      console.log(`[ActivityContext] Loaded ${response.activities.length} activities for user ${userId}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load activities';
      setError(errorMessage);
      console.error('[ActivityContext] Error loading activities:', err);
      
      showError('Failed to load activities', errorMessage, 5000);
    } finally {
      setLoading(false);
    }
  }, [getUserId, apiClient, showError, showSuccess]);

  /**
   * Load more activities (pagination)
   */
  const loadMoreActivities = useCallback(async () => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous' || !hasMore || loading) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const nextFilters = {
        ...currentFilters,
        offset: activities.length
      };

      const response = await apiClient.getActivities(userId, nextFilters);
      
      setActivities(prev => [...prev, ...response.activities]);
      setHasMore(response.pagination.hasMore);
      setCurrentFilters(nextFilters);

      console.log(`[ActivityContext] Loaded ${response.activities.length} more activities`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more activities';
      setError(errorMessage);
      console.error('[ActivityContext] Error loading more activities:', err);
    } finally {
      setLoading(false);
    }
  }, [getUserId, apiClient, currentFilters, activities.length, hasMore, loading]);

  /**
   * Refresh current activities
   */
  const refreshActivities = useCallback(async () => {
    await loadActivities();
  }, [loadActivities]);

  /**
   * Create a new activity
   */
  const createActivity = useCallback(async (data: CreateActivityData): Promise<BotActivity | null> => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous') {
      showError('Authentication required', 'Please connect your wallet to create activities', 5000);
      return null;
    }

    try {
      const response = await apiClient.createActivity(userId, data);
      
      // Add the new activity to the beginning of the list
      setActivities(prev => [response.activity, ...prev]);
      setTotalActivities(prev => prev + 1);

      showSuccess('Activity created', 'New activity has been recorded successfully', 3000);

      console.log(`[ActivityContext] Created activity ${response.activity.id}`);
      return response.activity;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create activity';
      setError(errorMessage);
      console.error('[ActivityContext] Error creating activity:', err);
      
      showError('Failed to create activity', errorMessage, 5000);
      
      return null;
    }
  }, [getUserId, apiClient, showError, showSuccess]);

  /**
   * Update an existing activity
   */
  const updateActivity = useCallback(async (
    activityId: string, 
    data: Partial<CreateActivityData>
  ): Promise<BotActivity | null> => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous') {
      showError('Authentication required', 'Please connect your wallet to update activities', 5000);
      return null;
    }

    try {
      const response = await apiClient.updateActivity(userId, activityId, data);
      
      // Update the activity in the list
      setActivities(prev => prev.map(activity => 
        activity.id === activityId ? response.activity : activity
      ));

      showSuccess('Activity updated', 'Activity has been updated successfully', 3000);

      console.log(`[ActivityContext] Updated activity ${activityId}`);
      return response.activity;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update activity';
      setError(errorMessage);
      console.error('[ActivityContext] Error updating activity:', err);
      
      showError('Failed to update activity', errorMessage, 5000);
      
      return null;
    }
  }, [getUserId, apiClient, showError, showSuccess]);

  /**
   * Delete an activity
   */
  const deleteActivity = useCallback(async (activityId: string): Promise<boolean> => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous') {
      showError('Authentication required', 'Please connect your wallet to delete activities', 5000);
      return false;
    }

    try {
      await apiClient.deleteActivity(userId, activityId);
      
      // Remove the activity from the list
      setActivities(prev => prev.filter(activity => activity.id !== activityId));
      setTotalActivities(prev => prev - 1);

      showSuccess('Activity deleted', 'Activity has been deleted successfully', 3000);

      console.log(`[ActivityContext] Deleted activity ${activityId}`);
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete activity';
      setError(errorMessage);
      console.error('[ActivityContext] Error deleting activity:', err);
      
      showError('Failed to delete activity', errorMessage, 5000);
      
      return false;
    }
  }, [getUserId, apiClient, showError, showSuccess]);

  /**
   * Set filters and reload activities
   */
  const setFilters = useCallback((filters: ActivityFilters) => {
    const newFilters = { limit: 50, offset: 0, ...filters };
    setCurrentFilters(newFilters);
    loadActivities(newFilters);
  }, [loadActivities]);

  // Load initial activities when user changes
  useEffect(() => {
    const userId = getUserId();
    if (userId && userId !== 'anonymous') {
      loadActivities();
    }
  }, [getUserId, loadActivities]);

  const contextValue: ActivityContextType = {
    // State
    activities,
    loading,
    error,
    hasMore,
    totalActivities,
    
    // Methods
    loadActivities,
    loadMoreActivities,
    refreshActivities,
    createActivity,
    updateActivity,
    deleteActivity,
    
    // Filters
    currentFilters,
    setFilters
  };

  return (
    <ActivityContext.Provider value={contextValue}>
      {children}
    </ActivityContext.Provider>
  );
}

/**
 * Hook to use the activity context
 */
export function useActivity() {
  const context = useContext(ActivityContext);
  if (context === undefined) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
}