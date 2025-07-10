/**
 * Analytics Type Definitions
 * Comprehensive types for real blockchain analytics and performance tracking
 */

// Base Transaction Event Types
export interface TransactionEvent {
  event_index: number;
  event_type: 'smart_contract_log' | 'stx_lock' | 'stx_asset' | 'fungible_token_asset' | 'non_fungible_token_asset';
  tx_id: string;
  contract_log?: {
    contract_id: string;
    topic: string;
    value: {
      hex: string;
      repr: string;
    };
  };
  stx_lock_event?: {
    locked_amount: string;
    unlock_height: string;
    locked_address: string;
  };
  asset?: {
    asset_event_type: 'transfer' | 'mint' | 'burn';
    asset_id: string;
    sender?: string;
    recipient?: string;
    amount: string;
  };
}

// Processed Transaction Analysis
export interface ProcessedTransaction {
  txId: string;
  timestamp: number;
  blockHeight: number;
  type: 'deposit' | 'withdrawal' | 'trade' | 'yield' | 'transfer' | 'contract_call';
  category: 'stx' | 'fungible_token' | 'nft' | 'defi' | 'yield_farming';
  
  // Financial data
  amount?: number;
  tokenId?: string;
  tokenSymbol?: string;
  usdValue?: number;
  
  // Trading data
  fromToken?: string;
  toToken?: string;
  swapRatio?: number;
  
  // Yield farming data
  rewardTokens?: Array<{
    tokenId: string;
    amount: number;
    usdValue?: number;
  }>;
  
  // Transaction costs
  fees?: {
    stx: number;
    usd?: number;
  };
  
  // Status
  status: 'success' | 'failed' | 'pending';
  error?: string;
}

// Portfolio Holdings
export interface PortfolioHolding {
  tokenId: string;
  symbol: string;
  name: string;
  balance: number;
  formattedBalance: number;
  decimals: number;
  
  // Pricing
  currentPrice: number;
  priceSource: string;
  priceTimestamp: number;
  
  // Valuation
  usdValue: number;
  costBasis?: number;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
  
  // Performance
  dayChange?: number;
  dayChangePercent?: number;
  weekChange?: number;
  weekChangePercent?: number;
}

// Performance Metrics
export interface PerformanceMetrics {
  // Time period
  startDate: Date;
  endDate: Date;
  
  // Portfolio value
  startingValue: number;
  currentValue: number;
  highWaterMark: number;
  
  // Returns
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn?: number;
  
  // Risk metrics
  volatility?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  maxDrawdownPercent?: number;
  
  // Trading metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWinAmount: number;
  avgLossAmount: number;
  profitFactor: number;
  
  // DeFi metrics
  totalYieldEarned: number;
  averageAPY?: number;
  totalFeesSpent: number;
}

// Time Series Data Point
export interface TimeSeriesPoint {
  timestamp: number;
  date: string;
  value: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  trades?: number;
}

// Analytics Summary
export interface AnalyticsSummary {
  // Period information
  period: {
    start: Date;
    end: Date;
    days: number;
  };
  
  // Portfolio overview
  portfolio: {
    totalValue: number;
    totalHoldings: number;
    totalTokens: number;
    largestPosition: {
      tokenId: string;
      value: number;
      percentage: number;
    };
  };
  
  // Performance summary
  performance: PerformanceMetrics;
  
  // Recent activity
  recentTransactions: ProcessedTransaction[];
  
  // Holdings breakdown
  holdings: PortfolioHolding[];
  
  // Time series data
  valueHistory: TimeSeriesPoint[];
  pnlHistory: TimeSeriesPoint[];
  
  // Strategy analysis
  strategies: {
    [strategyName: string]: {
      totalValue: number;
      totalReturn: number;
      returnPercent: number;
      transactionCount: number;
      winRate: number;
    };
  };
}

// Market Data
export interface MarketData {
  // Token prices
  tokenPrices: Record<string, number>;
  priceChanges: Record<string, number>;
  
  // Market overview
  marketCap: {
    total: number;
    change24h: number;
  };
  
  // DeFi data
  totalValueLocked?: number;
  
  // Opportunities
  opportunities: MarketOpportunity[];
}

export interface MarketOpportunity {
  type: 'arbitrage' | 'yield' | 'dca' | 'rebalance';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  
  // Arbitrage specific
  spread?: number;
  exchanges?: string[];
  
  // Yield specific
  apy?: number;
  pool?: string;
  
  // DCA specific
  suggestedAmount?: number;
  frequency?: string;
  
  // Rebalance specific
  currentAllocation?: Record<string, number>;
  targetAllocation?: Record<string, number>;
}

// Analytics Configuration
export interface AnalyticsConfig {
  // Data sources
  useRealData: boolean;
  cacheEnabled: boolean;
  cacheTTL: number;
  
  // Update intervals
  priceUpdateInterval: number;
  transactionSyncInterval: number;
  
  // Analysis parameters
  performanceWindow: number; // days
  volatilityWindow: number; // days
  riskFreeRate: number; // for Sharpe ratio
  
  // Filtering
  minTransactionValue: number;
  excludeTokens: string[];
  
  // Features
  enableYieldTracking: boolean;
  enableArbitrageDetection: boolean;
  enableRiskAnalysis: boolean;
}

// API Response Types
export interface AnalyticsApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: number;
    cached: boolean;
    source: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// Yield Farming Specific Types
export interface YieldFarmingEvent {
  txId: string;
  timestamp: number;
  type: 'stake' | 'unstake' | 'claim' | 'compound';
  
  // Energy token data
  energyAmount?: number;
  energyTokenId?: string;
  
  // Reward data
  rewardAmount?: number;
  rewardTokenId?: string;
  rewardSymbol?: string;
  
  // Conversion data (energy → HOOT)
  conversionRate?: number;
  hootReceived?: number;
  
  // USD values
  energyUsdValue?: number;
  rewardUsdValue?: number;
  
  // APY calculation
  estimatedAPY?: number;
}

export interface YieldFarmingAnalytics {
  // Summary
  totalEnergySpent: number;
  totalHootReceived: number;
  totalUsdInvested: number;
  totalUsdReturned: number;
  
  // Performance
  totalReturn: number;
  totalReturnPercent: number;
  averageAPY: number;
  
  // Activity
  totalTransactions: number;
  firstTransaction: Date;
  lastTransaction: Date;
  activeDays: number;
  
  // History
  events: YieldFarmingEvent[];
  dailyReturns: TimeSeriesPoint[];
  apyHistory: TimeSeriesPoint[];
}

// Error Types
export interface AnalyticsError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

// Cache Types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
}