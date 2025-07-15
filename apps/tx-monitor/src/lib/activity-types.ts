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
  // Price snapshot fields for historical accuracy
  priceSnapshot?: {
    price: number;
    timestamp: number;
    source: string; // 'blaze' | 'coinmarketcap' | 'manual'
  };
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

  // Order-specific fields
  orderType?: 'price_trigger' | 'time_trigger' | 'manual';
  targetPrice?: number;
  executionPrice?: number;
  waitTime?: string;
  strategy?: 'single' | 'dca' | 'twitter';
  strategyPosition?: number;
  strategyTotal?: number;

  // Social features
  replyCount: number;
  hasReplies: boolean;
  replies?: Reply[];

  // Metadata for extensibility
  metadata?: {
    notes?: string;
    slippage?: number;
    gasUsed?: string;
    router?: string;
    isSubnetShift?: boolean;
    isTwitterTriggered?: boolean;
    twitterHandle?: string;
    executionNumber?: number;
    totalInvested?: string;
    averagePrice?: string;
    cancellationReason?: string;
    errorMessage?: string;
    [key: string]: any;
  };
}

export interface ActivityFeedOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'type' | 'status';
  sortOrder?: 'asc' | 'desc';
  owner?: string;
  types?: ActivityType[];
  statuses?: ActivityStatus[];
  searchQuery?: string;
  dateRange?: {
    start: number;
    end: number;
  };
}

export interface ActivityFeedResult {
  activities: ActivityItem[];
  total: number;
  hasMore: boolean;
}

export interface ActivityUpdate {
  status?: ActivityStatus;
  txid?: string;
  blockHeight?: number;
  confirmations?: number;
  metadata?: Partial<ActivityItem['metadata']>;
  toToken?: Partial<TokenInfo>;
  replyCount?: number;
  hasReplies?: boolean;
}

export interface ActivityFeedFilters {
  types?: ActivityType[];
  statuses?: ActivityStatus[];
  searchQuery?: string;
  dateRange?: {
    start: number;
    end: number;
  };
  owner?: string;
}