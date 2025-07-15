"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ActivityItem } from '@/lib/activity/types';
import { ActivityCard } from './ActivityCard';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { RefreshCw, Loader2, BarChart3 } from 'lucide-react';

interface ActivityFeedProps {
  activities: ActivityItem[];
  metadata?: any;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  onActivityAction?: (action: string, activity: ActivityItem) => void;
  onAddReply?: (activityId: string, content: string) => void;
  onEditReply?: (replyId: string, newContent: string) => void;
  onDeleteReply?: (replyId: string) => void;
  onLikeReply?: (replyId: string) => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = React.memo(({
  activities,
  metadata = {},
  loading = false,
  hasMore = false,
  onLoadMore,
  onRefresh,
  onActivityAction,
  onAddReply,
  onEditReply,
  onDeleteReply,
  onLikeReply
}) => {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Sort activities by timestamp (most recent first)
  const sortedActivities = [...activities].sort((a, b) => b.timestamp - a.timestamp);

  // Handle infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
          setIsLoadingMore(true);
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Reset loading state when activities change
  useEffect(() => {
    setIsLoadingMore(false);
  }, [activities.length]);

  const handleRefresh = () => {
    if (onRefresh) {
      setLastRefresh(Date.now());
      onRefresh();
    }
  };

  const handleActivityAction = (action: string, activity: ActivityItem) => {
    onActivityAction?.(action, activity);

    // Handle built-in actions
    switch (action) {
      case 'copy_tx':
        // Show toast or feedback
        console.log('Transaction ID copied to clipboard');
        break;
      case 'favorite':
        // Could save to local storage or API
        console.log('Activity favorited:', activity.id);
        break;
      case 'share':
        // Open share dialog
        console.log('Share activity:', activity.id);
        break;
      default:
        break;
    }
  };

  if (loading && activities.length === 0) {
    return <ActivityFeedSkeleton />;
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/40">
        <div className="relative mb-6">
          <div className="h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-white/30" />
          </div>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
        </div>
        <h3 className="text-lg font-medium text-white/70 mb-2">No activity yet</h3>
        <p className="text-sm text-center max-w-md leading-relaxed mb-6">
          Your swaps and orders will appear here for real-time monitoring and management.
        </p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 text-sm font-medium bg-white/[0.08] text-white border border-white/[0.2] rounded-xl hover:bg-white/[0.12] transition-all duration-200"
        >
          Start Trading
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline Header */}
      <div className="flex justify-between items-center">
        <div className="text-white/60 text-sm">
          {activities.length} activities
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.03] rounded-xl transition-all duration-200 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span>Refresh</span>
        </button>
      </div>

      {/* Activity Timeline */}
      <div className="space-y-4">
        {sortedActivities.map((activity, index) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            metadata={metadata}
            onAction={handleActivityAction}
            onAddReply={onAddReply}
            onEditReply={onEditReply}
            onDeleteReply={onDeleteReply}
            onLikeReply={onLikeReply}
            className="animate-in fade-in duration-300"
            style={{
              animationDelay: `${index * 50}ms`
            }}
          />
        ))}
      </div>

      {/* Load More Trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          {isLoadingMore ? (
            <div className="flex items-center gap-3 text-sm text-white/70">
              <div className="h-5 w-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
              <span>Loading more activity...</span>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsLoadingMore(true);
                onLoadMore?.();
              }}
              className="px-6 py-2.5 text-sm font-medium bg-white/[0.03] border border-white/[0.08] text-white/70 hover:bg-white/[0.08] hover:text-white/90 rounded-xl transition-all duration-200"
            >
              Load More
            </button>
          )}
        </div>
      )}

      {/* End Message */}
      {!hasMore && activities.length > 0 && (
        <div className="text-center py-8 text-white/50 text-sm">
          That's all the activity! 🎉
        </div>
      )}
    </div>
  );
});

// Premium skeleton loader for initial loading state
export const ActivityFeedSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {[...Array(3)].map((_, groupIndex) => (
        <div key={groupIndex} className="space-y-4">
          {/* Group Header Skeleton */}
          <div className="border-b border-white/[0.08] pb-2">
            <div className="h-6 w-24 bg-white/[0.06] rounded-lg animate-pulse" />
          </div>

          {/* Activity Card Skeletons */}
          <div className="space-y-4">
            {[...Array(2)].map((_, cardIndex) => (
              <div
                key={cardIndex}
                className="group relative p-6 rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm animate-pulse"
              >
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

                <div className="relative space-y-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="h-4 w-16 bg-white/[0.06] rounded-lg" />
                      <div className="h-3 w-20 bg-white/[0.04] rounded-lg" />
                    </div>
                    <div className="h-6 w-20 bg-white/[0.06] rounded-full" />
                  </div>

                  {/* Swap row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-white/[0.06] rounded-full" />
                      <div className="h-4 w-12 bg-white/[0.06] rounded-lg" />
                      <div className="h-4 w-6 bg-white/[0.04] rounded-lg" />
                      <div className="h-8 w-8 bg-white/[0.06] rounded-full" />
                      <div className="h-4 w-12 bg-white/[0.06] rounded-lg" />
                    </div>
                    <div className="h-4 w-24 bg-white/[0.06] rounded-lg" />
                  </div>

                  {/* Condition row */}
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-48 bg-white/[0.06] rounded-lg" />
                    <div className="flex gap-2">
                      <div className="h-8 w-8 bg-white/[0.06] rounded-xl" />
                      <div className="h-8 w-8 bg-white/[0.06] rounded-xl" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};