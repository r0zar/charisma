/**
 * Utility functions for activity timeline
 */

import { ActivityItem, ActivityType, ActivityStatus, ActivityActionConfig } from './types';
import { ArrowLeftRight, Check, X, BarChart3, Twitter, HelpCircle, CheckCircle, Clock, Loader, XCircle, Ban } from 'lucide-react';

/**
 * Format token amounts for display
 */
export function formatTokenAmount(amount: string, decimals: number = 6, symbol?: string): string {
  const num = parseFloat(amount);
  
  if (isNaN(num)) return '0';
  
  let formatted: string;
  
  if (num >= 1_000_000) {
    formatted = (num / 1_000_000).toFixed(2) + 'M';
  } else if (num >= 1_000) {
    formatted = (num / 1_000).toFixed(1) + 'K';
  } else if (num >= 1) {
    formatted = num.toFixed(2);
  } else if (num >= 0.01) {
    formatted = num.toFixed(4);
  } else {
    formatted = num.toFixed(8);
  }
  
  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Format USD values
 */
export function formatUsdValue(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  } else {
    return `$${value.toFixed(2)}`;
  }
}

/**
 * Get relative time string (Twitter-style)
 */
export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  
  if (diff < minute) {
    return 'Just now';
  } else if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes}m`;
  } else if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours}h`;
  } else if (diff < week) {
    const days = Math.floor(diff / day);
    return `${days}d`;
  } else {
    const weeks = Math.floor(diff / week);
    return `${weeks}w`;
  }
}

/**
 * Get full timestamp for tooltips
 */
export function getFullTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Get prominent date display for activity cards
 */
export function getProminentDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (activityDate.getTime() === today.getTime()) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (activityDate.getTime() === yesterday.getTime()) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Timeline grouping functions removed - activities now display chronologically with prominent dates

/**
 * Get activity type display info
 */
export function getActivityTypeInfo(type: ActivityType): {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
} {
  switch (type) {
    case 'instant_swap':
      return {
        icon: ArrowLeftRight,
        label: 'Instant Swap',
        color: 'text-blue-400'
      };
    case 'order_filled':
      return {
        icon: Check,
        label: 'Order Filled',
        color: 'text-green-400'
      };
    case 'order_cancelled':
      return {
        icon: X,
        label: 'Order Cancelled',
        color: 'text-gray-400'
      };
    case 'dca_update':
      return {
        icon: BarChart3,
        label: 'DCA Update',
        color: 'text-purple-400'
      };
    case 'twitter_trigger':
      return {
        icon: Twitter,
        label: 'Twitter Trigger',
        color: 'text-sky-400'
      };
    default:
      return {
        icon: HelpCircle,
        label: 'Unknown',
        color: 'text-gray-400'
      };
  }
}

/**
 * Get status display info
 */
export function getStatusInfo(status: ActivityStatus): {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
} {
  switch (status) {
    case 'completed':
      return {
        icon: CheckCircle,
        label: 'Completed',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10'
      };
    case 'pending':
      return {
        icon: Clock,
        label: 'Pending',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10'
      };
    case 'processing':
      return {
        icon: Loader,
        label: 'Processing',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10'
      };
    case 'failed':
      return {
        icon: XCircle,
        label: 'Failed',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10'
      };
    case 'cancelled':
      return {
        icon: Ban,
        label: 'Cancelled',
        color: 'text-gray-400',
        bgColor: 'bg-gray-500/10'
      };
    default:
      return {
        icon: HelpCircle,
        label: 'Unknown',
        color: 'text-gray-400',
        bgColor: 'bg-gray-500/10'
      };
  }
}

/**
 * Get available actions for activity item
 */
export function getActivityActions(activity: ActivityItem): ActivityActionConfig[] {
  const actions: ActivityActionConfig[] = [];
  
  // Always available actions
  actions.push({
    type: 'favorite',
    label: 'Favorite',
    icon: 'Heart'
  });
  
  actions.push({
    type: 'note',
    label: 'Add Note',
    icon: 'MessageCircle'
  });
  
  actions.push({
    type: 'share',
    label: 'Share',
    icon: 'Share'
  });
  
  // Conditional actions
  if (activity.status === 'completed' && activity.txid) {
    actions.push({
      type: 'copy_tx',
      label: 'Copy TX',
      icon: 'Copy'
    });
  }
  
  if (activity.type === 'instant_swap' || (activity.type === 'order_filled' && activity.strategy === 'single')) {
    actions.push({
      type: 'repeat',
      label: 'Repeat',
      icon: 'Repeat2'
    });
  }
  
  actions.push({
    type: 'view_details',
    label: 'Details',
    icon: 'MoreHorizontal',
    primary: true
  });
  
  return actions;
}

/**
 * Get price impact color
 */
export function getPriceImpactColor(priceImpact: number): string {
  if (Math.abs(priceImpact) < 1) {
    return 'text-green-400';
  } else if (Math.abs(priceImpact) < 3) {
    return 'text-yellow-400';
  } else {
    return 'text-red-400';
  }
}

/**
 * Get activity description for accessibility
 */
export function getActivityDescription(activity: ActivityItem): string {
  const typeInfo = getActivityTypeInfo(activity.type);
  const fromAmount = formatTokenAmount(activity.fromToken.amount, activity.fromToken.decimals, activity.fromToken.symbol);
  const toAmount = formatTokenAmount(activity.toToken.amount, activity.toToken.decimals, activity.toToken.symbol);
  const relativeTime = getRelativeTime(activity.timestamp);
  const userName = formatUserName(activity.owner, activity.displayName);
  
  return `${userName}: ${typeInfo.label}: ${fromAmount} to ${toAmount}, ${activity.status}, ${relativeTime}`;
}

/**
 * Format user name for display
 */
export function formatUserName(owner: string, displayName?: string): string {
  if (displayName) {
    return displayName;
  }
  
  // Format wallet address
  if (owner.length > 20 && owner.startsWith('SP')) {
    return `${owner.slice(0, 8)}...${owner.slice(-4)}`;
  }
  
  return owner;
}

/**
 * Get user avatar letter
 */
export function getUserAvatarLetter(owner: string, displayName?: string): string {
  if (displayName) {
    return displayName.charAt(0).toUpperCase();
  }
  
  // Use 3rd character of wallet address to avoid all being 'S'
  return owner.charAt(2).toUpperCase();
}