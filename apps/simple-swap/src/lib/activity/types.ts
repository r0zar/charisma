/**
 * Unified activity types for timeline feed
 * Combines instant swaps and triggered orders into a consistent interface
 */

export type ActivityType = 'instant_swap' | 'order_filled' | 'order_cancelled' | 'dca_update' | 'twitter_trigger';
export type ActivityStatus = 'completed' | 'pending' | 'failed' | 'cancelled' | 'processing';

export interface PriceSnapshot {
  price: number;
  timestamp: number;
  source: string; // 'oracle', 'dex', 'coingecko', etc.
  blockHeight?: number;
}

export interface TokenInfo {
  symbol: string;
  amount: string;
  contractId: string;
  decimals?: number;
  usdValue?: number;

  // Price data captured at trade execution time
  priceSnapshot?: PriceSnapshot;

  // Enriched metadata from Blaze SDK
  name?: string;
  image?: string;
  description?: string;
  price?: number; // Current price (for display)
  change24h?: number;
  marketCap?: number;
  verified?: boolean;
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
    
    // Profitability tracking metadata
    tradeValue?: number; // USD value at trade execution
    entryPrices?: {
      fromToken: number;
      toToken: number;
    };
    transactionAnalysis?: any; // Keep existing transaction analysis
    
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