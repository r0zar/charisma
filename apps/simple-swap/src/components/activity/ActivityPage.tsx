"use client";

import React, { useState, useEffect, useMemo, useTransition, useDeferredValue, useRef, useCallback } from 'react';
import { ActivityItem, ActivityType, ActivityStatus, ActivityFeedFilters, Reply } from '@/lib/activity/types';
import { fetchActivityTimeline, addActivityReply, updateActivityReply, deleteActivityReply } from '@/lib/activity/api';
import { ActivityFeed } from './ActivityFeed';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { toast } from '../ui/sonner';
import { useBlaze } from 'blaze-sdk/realtime';
import { enrichTokenWithMetadata } from '@/lib/activity/utils';
import { useWallet } from '@/contexts/wallet-context';
import { PortfolioPnLWidget } from './PortfolioPnLWidget';
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
  const { address: userAddress, connected } = useWallet();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadOffset, setLoadOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Filter state
  const [filters, setFilters] = useState<ActivityFeedFilters>({});

  // Blaze SDK for token metadata and prices
  const { metadata, getPrice } = useBlaze();

  // Real-time refresh for pending activities
  const [pendingActivities, setPendingActivities] = useState<Set<string>>(new Set());

  // Function to enrich activities with token metadata
  const enrichActivities = useMemo(() => {
    return (activities: ActivityItem[]): ActivityItem[] => {
      return activities.map(activity => ({
        ...activity,
        fromToken: enrichTokenWithMetadata(activity.fromToken, metadata, getPrice),
        toToken: enrichTokenWithMetadata(activity.toToken, metadata, getPrice)
      }));
    };
  }, [metadata, getPrice]);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  // Use deferred value for search query to avoid blocking UI during typing
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Use refs for stable references
  const loadingRef = useRef(loading);
  const activitiesRef = useRef(activities);

  // Update refs when values change
  useEffect(() => {
    loadingRef.current = loading;
    activitiesRef.current = activities;
  }, [loading, activities]);

  // Enriched activities with metadata (automatically updates when metadata changes)
  const enrichedActivities = useMemo(() => {
    return enrichActivities(activities);
  }, [activities, enrichActivities]);

  // Enriched filtered activities
  const enrichedFilteredActivities = useMemo(() => {
    return enrichActivities(filteredActivities);
  }, [filteredActivities, enrichActivities]);

  // Track pending activities for real-time polling
  useEffect(() => {
    const updatePendingActivities = () => {
      const pendingIds = new Set<string>();
      activities.forEach(activity => {
        if (activity.status === 'pending' || activity.status === 'processing') {
          pendingIds.add(activity.id);
        }
      });
      setPendingActivities(pendingIds);
    };

    updatePendingActivities();
  }, [activities]);

  // Real-time polling for pending activities
  useEffect(() => {
    if (pendingActivities.size === 0) return;

    console.log(`[ActivityPage] Polling ${pendingActivities.size} pending activities for status updates`);

    const pollInterval = setInterval(async () => {
      try {
        // Refresh activities to get latest status updates
        const result = await fetchActivityTimeline({
          limit: 50,
          offset: 0,
          sortOrder: 'desc',
          types: filters.types,
          statuses: filters.statuses,
          searchQuery: searchQuery.trim() || undefined
        });

        // Check if any pending activities have been updated
        let hasUpdates = false;
        const updatedPendingIds = new Set<string>();

        result.activities.forEach(activity => {
          if (pendingActivities.has(activity.id)) {
            if (activity.status !== 'pending' && activity.status !== 'processing') {
              console.log(`[ActivityPage] Activity ${activity.id} status updated: ${activity.status}`);
              hasUpdates = true;
            } else {
              updatedPendingIds.add(activity.id);
            }
          }
        });

        // Update activities if we found status changes
        if (hasUpdates) {
          setActivities(result.activities);
          setFilteredActivities(result.activities);
          setPendingActivities(updatedPendingIds);
          setLastRefresh(Date.now());
          console.log(`[ActivityPage] Updated ${pendingActivities.size - updatedPendingIds.size} activities from pending status`);
        }
      } catch (error) {
        console.error('[ActivityPage] Error polling pending activities:', error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [pendingActivities, filters, searchQuery]);

  // Listen for activity status updates from transaction completions
  useEffect(() => {
    const handleActivityStatusUpdate = async (event: CustomEvent) => {
      const { txid, recordId, status } = event.detail;
      console.log(`[ActivityPage] Received activity status update: ${recordId} (${txid}) -> ${status}`);

      // Force refresh the activities to get the latest status
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
        setLastRefresh(Date.now());
        console.log(`[ActivityPage] Refreshed activities after transaction completion: ${txid}`);
      } catch (error) {
        console.error('[ActivityPage] Error refreshing activities after status update:', error);
      }
    };

    // Add event listener
    window.addEventListener('activityStatusUpdate', handleActivityStatusUpdate as EventListener);

    return () => {
      window.removeEventListener('activityStatusUpdate', handleActivityStatusUpdate as EventListener);
    };
  }, [filters, searchQuery]);

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

  // Optimized filter application using deferred value and transitions
  useEffect(() => {
    const loadFilteredData = async () => {
      if (loadingRef.current) return; // Don't filter during initial load

      // Use transition for non-blocking updates
      startTransition(() => {
        setLoading(true);
        setError(null);
      });

      try {
        const result = await fetchActivityTimeline({
          limit: 50,
          offset: 0,
          sortOrder: 'desc',
          types: filters.types,
          statuses: filters.statuses,
          searchQuery: deferredSearchQuery.trim() || undefined
        });

        // Update state in a transition to avoid blocking
        startTransition(() => {
          setActivities(result.activities);
          setFilteredActivities(result.activities);
          setTotal(result.total);
          setHasMore(result.hasMore);
          setLoadOffset(50); // Reset offset for filtered results
        });
      } catch (err) {
        console.error('Error loading filtered activity data:', err);
        startTransition(() => {
          setError(err instanceof Error ? err.message : 'Failed to filter activities');
        });
      } finally {
        startTransition(() => {
          setLoading(false);
        });
      }
    };

    // Debounce the deferred search query
    const debounceTimer = setTimeout(loadFilteredData, 300);
    return () => clearTimeout(debounceTimer);
  }, [filters, deferredSearchQuery]);

  const handleLoadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    // Use transition for smooth loading state
    startTransition(() => {
      setLoading(true);
      setError(null);
    });

    try {
      const result = await fetchActivityTimeline({
        limit: 50,
        offset: loadOffset,
        sortOrder: 'desc',
        types: filters.types,
        statuses: filters.statuses,
        searchQuery: deferredSearchQuery.trim() || undefined
      });

      startTransition(() => {
        setActivities(prev => [...prev, ...result.activities]);
        setFilteredActivities(prev => [...prev, ...result.activities]);
        setHasMore(result.hasMore);
        setLoadOffset(prev => prev + 50);
      });
    } catch (err) {
      console.error('Error loading more activities:', err);
      startTransition(() => {
        setError(err instanceof Error ? err.message : 'Failed to load more activities');
      });
    } finally {
      startTransition(() => {
        setLoading(false);
      });
    }
  }, [loading, hasMore, loadOffset, filters, deferredSearchQuery]);

  const handleRefresh = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
      setError(null);
    });

    try {
      const result = await fetchActivityTimeline({
        limit: 50,
        offset: 0,
        sortOrder: 'desc',
        types: filters.types,
        statuses: filters.statuses,
        searchQuery: deferredSearchQuery.trim() || undefined
      });

      startTransition(() => {
        setActivities(result.activities);
        setFilteredActivities(result.activities);
        setTotal(result.total);
        setHasMore(result.hasMore);
        setLoadOffset(50);
        setLastRefresh(Date.now());
      });
    } catch (err) {
      console.error('Error refreshing activities:', err);
      startTransition(() => {
        setError(err instanceof Error ? err.message : 'Failed to refresh activities');
      });
    } finally {
      startTransition(() => {
        setLoading(false);
      });
    }
  }, [filters, deferredSearchQuery]);

  const handleActivityAction = (action: string, activity: ActivityItem) => {
    console.log('Activity action:', action, activity.id);
    // Handle various actions like favorite, share, repeat, etc.
  };

  // Reply handlers
  const handleAddReply = async (activityId: string, content: string) => {
    try {
      if (!connected || !userAddress) {
        toast.error('Please connect your wallet to add replies');
        return;
      }

      console.log('Adding reply to activity:', activityId, content);

      // Call API to add reply
      const newReply = await addActivityReply(
        activityId,
        content,
        userAddress
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
      if (!connected || !userAddress) {
        toast.error('Please connect your wallet to edit replies');
        return;
      }

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
        userAddress
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

  const toggleTypeFilter = useCallback((type: ActivityType) => {
    startTransition(() => {
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
    });
  }, []);

  const toggleStatusFilter = useCallback((status: ActivityStatus) => {
    startTransition(() => {
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
    });
  }, []);

  const clearFilters = useCallback(() => {
    startTransition(() => {
      setFilters({});
      setSearchQuery('');
    });
  }, []);

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
              <span className={isPending ? 'opacity-70 transition-opacity' : ''}>
                {total > 0 ? `${filteredActivities.length} of ${total} activities` : `${filteredActivities.length} activities`}
                {isPending && <span className="ml-2 text-xs text-white/40">(updating...)</span>}
              </span>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${pendingActivities.size > 0 ? 'bg-yellow-400' : 'bg-emerald-400'}`} />
                  <div className={`absolute inset-0 h-1.5 w-1.5 rounded-full animate-ping ${pendingActivities.size > 0 ? 'bg-yellow-400/40' : 'bg-emerald-400/40'}`} />
                  <div className={`absolute inset-[-1px] h-2.5 w-2.5 rounded-full blur-sm animate-pulse ${pendingActivities.size > 0 ? 'bg-yellow-400/20' : 'bg-emerald-400/20'}`} />
                </div>
                <span className="animate-pulse">
                  {pendingActivities.size > 0 ? `Monitoring ${pendingActivities.size} pending` : 'Live monitoring'}
                </span>
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

        {/* Portfolio P&L Widget - prominently displayed */}
        <PortfolioPnLWidget className="px-6 py-4 rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm" />
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
        activities={enrichedFilteredActivities}
        metadata={metadata}
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