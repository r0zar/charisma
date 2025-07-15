"use client";

import React, { useState, useEffect } from 'react';
import { ActivityItem, ActivityType, ActivityStatus, ActivityFeedFilters, Reply } from '@/lib/activity/types';
import { fetchActivityTimeline, addActivityReply, updateActivityReply, deleteActivityReply } from '@/lib/activity/api';
import { ActivityFeed } from './ActivityFeed';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { toast } from '../ui/sonner';
import {
  Search,
  Filter,
  Settings,
  Download,
  ChevronDown,
  X
} from 'lucide-react';

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  instant_swap: 'Instant Swaps',
  order_filled: 'Orders Filled',
  order_cancelled: 'Orders Cancelled',
  dca_update: 'DCA Updates',
  twitter_trigger: 'Twitter Triggers'
};

const STATUS_LABELS: Record<ActivityStatus, string> = {
  completed: 'Completed',
  pending: 'Pending',
  processing: 'Processing',
  failed: 'Failed',
  cancelled: 'Cancelled'
};

export const ActivityPage: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadOffset, setLoadOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<ActivityFeedFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await fetchActivityTimeline({
          limit: 50,
          offset: 0,
          sortOrder: 'desc'
        });
        
        setActivities(result.activities);
        setFilteredActivities(result.activities);
        setTotal(result.total);
        setHasMore(result.hasMore);
        setLoadOffset(50); // Next offset for pagination
      } catch (err) {
        console.error('Error loading initial activity data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load activities');
        setActivities([]);
        setFilteredActivities([]);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Apply filters - trigger new API call instead of client-side filtering
  useEffect(() => {
    const loadFilteredData = async () => {
      if (loading) return; // Don't filter during initial load
      
      setLoading(true);
      setError(null);
      
      try {
        const result = await fetchActivityTimeline({
          limit: 50,
          offset: 0,
          sortOrder: 'desc',
          types: filters.types,
          statuses: filters.statuses,
          searchQuery: searchQuery.trim() || undefined
        });
        
        setActivities(result.activities);
        setFilteredActivities(result.activities);
        setTotal(result.total);
        setHasMore(result.hasMore);
        setLoadOffset(50); // Reset offset for filtered results
      } catch (err) {
        console.error('Error loading filtered activity data:', err);
        setError(err instanceof Error ? err.message : 'Failed to filter activities');
      } finally {
        setLoading(false);
      }
    };

    // Debounce the search query
    const debounceTimer = setTimeout(loadFilteredData, 300);
    return () => clearTimeout(debounceTimer);
  }, [filters, searchQuery]);

  const handleLoadMore = async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchActivityTimeline({
        limit: 50,
        offset: loadOffset,
        sortOrder: 'desc',
        types: filters.types,
        statuses: filters.statuses,
        searchQuery: searchQuery.trim() || undefined
      });
      
      setActivities(prev => [...prev, ...result.activities]);
      setFilteredActivities(prev => [...prev, ...result.activities]);
      setHasMore(result.hasMore);
      setLoadOffset(prev => prev + 50);
    } catch (err) {
      console.error('Error loading more activities:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more activities');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchActivityTimeline({
        limit: 50,
        offset: 0,
        sortOrder: 'desc',
        types: filters.types,
        statuses: filters.statuses,
        searchQuery: searchQuery.trim() || undefined
      });
      
      setActivities(result.activities);
      setFilteredActivities(result.activities);
      setTotal(result.total);
      setHasMore(result.hasMore);
      setLoadOffset(50);
    } catch (err) {
      console.error('Error refreshing activities:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh activities');
    } finally {
      setLoading(false);
    }
  };

  const handleActivityAction = (action: string, activity: ActivityItem) => {
    console.log('Activity action:', action, activity.id);
    // Handle various actions like favorite, share, repeat, etc.
  };

  // Reply handlers
  const handleAddReply = async (activityId: string, content: string) => {
    try {
      console.log('Adding reply to activity:', activityId, content);
      
      // Call API to add reply
      const newReply = await addActivityReply(
        activityId, 
        content, 
        'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60' // Current user - TODO: get from auth context
      );

      // Update activities state
      setActivities(prev => prev.map(activity => {
        if (activity.id === activityId) {
          const updatedReplies = [...(activity.replies || []), newReply];
          return {
            ...activity,
            replies: updatedReplies,
            replyCount: updatedReplies.length,
            hasReplies: true
          };
        }
        return activity;
      }));
      
      setFilteredActivities(prev => prev.map(activity => {
        if (activity.id === activityId) {
          const updatedReplies = [...(activity.replies || []), newReply];
          return {
            ...activity,
            replies: updatedReplies,
            replyCount: updatedReplies.length,
            hasReplies: true
          };
        }
        return activity;
      }));
      
      toast.success('Reply added successfully');
    } catch (err) {
      console.error('Error adding reply:', err);
      toast.error('Failed to add reply');
    }
  };

  const handleEditReply = async (replyId: string, newContent: string) => {
    try {
      console.log('Editing reply:', replyId, newContent);
      
      // Find the activity and reply to get the activityId
      let activityId: string | null = null;
      for (const activity of activities) {
        if (activity.replies?.some(reply => reply.id === replyId)) {
          activityId = activity.id;
          break;
        }
      }
      
      if (!activityId) {
        throw new Error('Activity not found for reply');
      }
      
      // Call API to update reply
      const updatedReply = await updateActivityReply(
        activityId,
        replyId,
        newContent,
        'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60' // Current user - TODO: get from auth context
      );
      
      // Update both activities and filteredActivities
      const updateReplies = (activities: ActivityItem[]) => 
        activities.map(activity => ({
          ...activity,
          replies: activity.replies?.map(reply => 
            reply.id === replyId ? updatedReply : reply
          )
        }));
      
      setActivities(updateReplies);
      setFilteredActivities(updateReplies);
      
      toast.success('Reply updated successfully');
    } catch (err) {
      console.error('Error updating reply:', err);
      toast.error('Failed to update reply');
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    try {
      console.log('Deleting reply:', replyId);
      
      // Find the activity and reply to get the activityId
      let activityId: string | null = null;
      for (const activity of activities) {
        if (activity.replies?.some(reply => reply.id === replyId)) {
          activityId = activity.id;
          break;
        }
      }
      
      if (!activityId) {
        throw new Error('Activity not found for reply');
      }
      
      // Call API to delete reply
      await deleteActivityReply(activityId, replyId);
      
      // Update both activities and filteredActivities
      const updateReplies = (activities: ActivityItem[]) => 
        activities.map(activity => {
          if (activity.replies?.some(reply => reply.id === replyId)) {
            const updatedReplies = activity.replies.filter(reply => reply.id !== replyId);
            return {
              ...activity,
              replies: updatedReplies,
              replyCount: updatedReplies.length,
              hasReplies: updatedReplies.length > 0
            };
          }
          return activity;
        });
      
      setActivities(updateReplies);
      setFilteredActivities(updateReplies);
      
      toast.success('Reply deleted successfully');
    } catch (err) {
      console.error('Error deleting reply:', err);
      toast.error('Failed to delete reply');
    }
  };

  const handleLikeReply = (replyId: string) => {
    console.log('Liking reply:', replyId);
    // In a real app, this would update like status in the backend
  };

  const toggleTypeFilter = (type: ActivityType) => {
    setFilters(prev => {
      const currentTypes = prev.types || [];
      const newTypes = currentTypes.includes(type)
        ? currentTypes.filter(t => t !== type)
        : [...currentTypes, type];

      return {
        ...prev,
        types: newTypes.length > 0 ? newTypes : undefined
      };
    });
  };

  const toggleStatusFilter = (status: ActivityStatus) => {
    setFilters(prev => {
      const currentStatuses = prev.statuses || [];
      const newStatuses = currentStatuses.includes(status)
        ? currentStatuses.filter(s => s !== status)
        : [...currentStatuses, status];

      return {
        ...prev,
        statuses: newStatuses.length > 0 ? newStatuses : undefined
      };
    });
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  const activeFilterCount = [
    filters.types?.length || 0,
    filters.statuses?.length || 0,
    searchQuery.trim() ? 1 : 0,
    filters.tokenFilter ? 1 : 0
  ].reduce((sum, count) => sum + (count > 0 ? 1 : 0), 0);

  return (
    <div className="container px-2 py-4 sm:px-4 sm:py-8">
      {/* Immersive header - seamless design */}
      <div className="space-y-8 mb-16">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          {/* Clean title section */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-medium text-white/95 tracking-wide mb-3">Activity</h1>
              <p className="text-white/60 max-w-2xl text-base leading-relaxed">
                Follow the pulse of the entire Charisma ecosystem with real-time activity from all users.
                Monitor swaps, orders, and DCA strategies across the network in one unified global feed.
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/40">
              <span>
                {total > 0 ? `${filteredActivities.length} of ${total} activities` : `${filteredActivities.length} activities`}
              </span>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <div className="absolute inset-0 h-1.5 w-1.5 bg-emerald-400/40 rounded-full animate-ping" />
                  <div className="absolute inset-[-1px] h-2.5 w-2.5 bg-emerald-400/20 rounded-full blur-sm animate-pulse" />
                </div>
                <span className="animate-pulse">Live monitoring</span>
              </div>
            </div>
          </div>

          {/* Export and settings controls */}
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info('Export feature coming soon!', {
                description: 'Export activity data to CSV, JSON, or PDF'
              })}
              className="border-white/[0.08] bg-white/[0.03] text-white/80 hover:bg-white/[0.08] hover:text-white transition-all duration-200"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info('Activity settings coming soon!', {
                description: 'Customize filters, notifications, and display preferences'
              })}
              className="border-white/[0.08] bg-white/[0.03] text-white/80 hover:bg-white/[0.08] hover:text-white transition-all duration-200"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="space-y-8 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search input */}
          <div className="relative flex-1 lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by token, transaction, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={loading}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/90 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/[0.15] focus:border-white/[0.2] transition-all duration-200 disabled:opacity-50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white/80 transition-all duration-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Premium filter tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              disabled={loading}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center gap-2 ${showFilters
                ? 'bg-white/[0.08] text-white border border-white/[0.2] shadow-lg backdrop-blur-sm'
                : 'text-white/60 hover:text-white/90 hover:bg-white/[0.03] border border-transparent'
                }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              {activeFilterCount > 0 && (
                <div className="absolute -top-2 -right-2 h-5 w-5 bg-blue-500 rounded-full flex items-center justify-center text-xs font-medium text-white">
                  {activeFilterCount}
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Premium Filter Panel */}
        {showFilters && (
          <div className="rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

            <div className="relative p-6 space-y-6">
              {/* Activity Types */}
              <div>
                <h3 className="text-sm font-medium text-white/90 mb-3 tracking-wider uppercase">Activity Types</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ACTIVITY_TYPE_LABELS).map(([type, label]) => (
                    <button
                      key={type}
                      onClick={() => toggleTypeFilter(type as ActivityType)}
                      className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${filters.types?.includes(type as ActivityType)
                        ? 'bg-white/[0.08] text-white border border-white/[0.2] shadow-lg backdrop-blur-sm'
                        : 'text-white/60 hover:text-white/90 hover:bg-white/[0.03] border border-transparent'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="text-sm font-medium text-white/90 mb-3 tracking-wider uppercase">Status</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_LABELS).map(([status, label]) => (
                    <button
                      key={status}
                      onClick={() => toggleStatusFilter(status as ActivityStatus)}
                      className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${filters.statuses?.includes(status as ActivityStatus)
                        ? 'bg-white/[0.08] text-white border border-white/[0.2] shadow-lg backdrop-blur-sm'
                        : 'text-white/60 hover:text-white/90 hover:bg-white/[0.03] border border-transparent'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
                <div className="text-sm text-white/60">
                  {total > 0 ? `${filteredActivities.length} of ${total} activities shown` : `${filteredActivities.length} activities shown`}
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.03] rounded-xl transition-all duration-200"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="px-4 py-2 text-sm font-medium bg-white/[0.08] text-white border border-white/[0.2] rounded-xl hover:bg-white/[0.12] transition-all duration-200"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Display */}
        {activeFilterCount > 0 && !showFilters && (
          <div className="flex items-center space-x-2 flex-wrap">
            <span className="text-sm text-white/60">Active filters:</span>

            {filters.types?.map(type => (
              <div key={type} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-white/[0.08] border border-white/[0.15] text-white/90">
                {ACTIVITY_TYPE_LABELS[type]}
                <button
                  onClick={() => toggleTypeFilter(type)}
                  className="ml-1 hover:text-red-400 transition-colors duration-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {filters.statuses?.map(status => (
              <div key={status} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-white/[0.08] border border-white/[0.15] text-white/90">
                {STATUS_LABELS[status]}
                <button
                  onClick={() => toggleStatusFilter(status)}
                  className="ml-1 hover:text-red-400 transition-colors duration-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {searchQuery && (
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-white/[0.08] border border-white/[0.15] text-white/90">
                Search: "{searchQuery}"
                <button
                  onClick={() => setSearchQuery('')}
                  className="ml-1 hover:text-red-400 transition-colors duration-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <button
              onClick={clearFilters}
              className="px-3 py-1 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.03] rounded-xl transition-all duration-200"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <p className="text-sm">Error loading activities: {error}</p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Activity Feed */}
      <ActivityFeed
        activities={filteredActivities}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onRefresh={handleRefresh}
        onActivityAction={handleActivityAction}
        onAddReply={handleAddReply}
        onEditReply={handleEditReply}
        onDeleteReply={handleDeleteReply}
        onLikeReply={handleLikeReply}
      />
    </div>
  );
};