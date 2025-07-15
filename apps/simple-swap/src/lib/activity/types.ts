/**
 * Unified activity types for timeline feed
 * Combines instant swaps and triggered orders into a consistent interface
 */

export type ActivityType = 'instant_swap' | 'order_filled' | 'order_cancelled' | 'dca_update' | 'twitter_trigger';
export type ActivityStatus = 'completed' | 'pending' | 'failed' | 'cancelled' | 'processing';

export interface TokenInfo {
  symbol: string;
  amount: string;
  contractId: string;
  decimals?: number;
  usdValue?: number;
}

export interface Reply {
  id: string;
  activityId: string;
  content: string;
  timestamp: number;
  author: string; // wallet address or username
  metadata?: {
    isEdited?: boolean;
    editedAt?: number;
  };
}

export interface ActivityItem {
  id: string;
  type: ActivityType;
  timestamp: number;
  status: ActivityStatus;

  // User/Owner information
  owner: string; // wallet address or username
  displayName?: string; // optional display name

  // Core swap/order data
  fromToken: TokenInfo;
  toToken: TokenInfo;

  // Transaction details
  txid?: string;
  blockHeight?: number;
  confirmations?: number;

  // Pricing and routing
  priceImpact?: number;
  route?: string[];
  executionPrice?: number;
  targetPrice?: number;

  // Order-specific data
  orderType?: 'price_trigger' | 'ratio_trigger' | 'time_trigger' | 'manual';
  strategy?: 'single' | 'dca' | 'twitter';
  strategyPosition?: number; // e.g., "3 of 5" for DCA
  strategyTotal?: number;
  waitTime?: string; // human readable, e.g., "3 days"

  // Reply system
  replies?: Reply[];
  replyCount?: number;
  hasReplies?: boolean;

  // Metadata
  metadata?: {
    isSubnetShift?: boolean;
    gasUsed?: string;
    slippage?: number;
    router?: string;
    notes?: string;
    isTwitterTriggered?: boolean;
    twitterHandle?: string;
    errorMessage?: string;
    lastStatusUpdate?: number;
    orderStatus?: string;
    completedAt?: number;
    orderUuid?: string;
    twitterStatus?: string;
    txStatus?: string;
  };
}

export interface ActivityFeedFilters {
  types?: ActivityType[];
  statuses?: ActivityStatus[];
  dateRange?: {
    start: number;
    end: number;
  };
  searchQuery?: string;
  tokenFilter?: string;
}

export interface ActivityFeedOptions extends ActivityFeedFilters {
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'amount' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface ActivityFeedResult {
  activities: ActivityItem[];
  total: number;
  hasMore: boolean;
}

// Timeline grouping is no longer used - activities are displayed chronologically with prominent dates

// Action types for activity cards
export type ActivityAction = 'favorite' | 'note' | 'repeat' | 'share' | 'view_details' | 'copy_tx';

export interface ActivityActionConfig {
  type: ActivityAction;
  label: string;
  icon: string;
  disabled?: boolean;
  primary?: boolean;
}