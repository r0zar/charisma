// Global Application State Type Definitions
import { Bot, BotStats, BotActivity, PerformanceMetrics, MarketData } from './bot';
import { AppSettings } from '@/contexts/settings-context';

// UI Preferences (not in settings context)
export interface UIPreferences {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  skin: 'default' | 'ocean' | 'sunset' | 'forest' | 'lavender';
  language: 'en' | 'es' | 'fr' | 'de' | 'zh';
  timezone: string;
  dateFormat: 'ISO' | 'US' | 'EU';
  numberFormat: 'US' | 'EU';
}

// Wallet State
export interface WalletState {
  isConnected: boolean;
  address: string | null;
  network: 'mainnet' | 'testnet' | 'devnet';
  balance: {
    stx: number;
    tokens: TokenBalance[];
  };
  transactions: WalletTransaction[];
  connectionMethod: 'hiro' | 'xverse' | 'ledger' | null;
}

export interface TokenBalance {
  contractId: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  image?: string;
  usdValue?: number;
}

export interface WalletTransaction {
  txId: string;
  timestamp: string;
  type: 'send' | 'receive' | 'contract-call' | 'deploy';
  amount: number;
  token: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockHeight?: number;
  fee: number;
  memo?: string;
}

// DeFi Pool Information
export interface DeFiPool {
  id: string;
  name: string;
  protocol: string;
  tokenA: {
    symbol: string;
    contractId: string;
    amount: number;
  };
  tokenB: {
    symbol: string;
    contractId: string;
    amount: number;
  };
  totalValueLocked: number;
  apr: number;
  volume24h: number;
  fees24h: number;
  createdAt: string;
  isActive: boolean;
}

// Notification State
export interface NotificationState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: string;
  read: boolean;
  persistent: boolean;
  actionUrl?: string;
}

// Analytics and Performance Data
export interface AnalyticsData {
  performance: PerformanceMetrics;
  portfolio: {
    totalValue: number;
    distribution: {
      stx: number;
      lpTokens: number;
      rewardTokens: number;
      cash: number;
    };
    allocation: {
      yieldFarming: number;
      dca: number;
      arbitrage: number;
      liquidityMining: number;
    };
  };
  metrics: {
    totalTrades: number;
    winRate: number;
    averageTradeSize: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalFees: number;
    timeActive: number; // in hours
  };
}

// Generator Metadata
export interface GeneratorMetadata {
  version: string;
  generatedAt: string;
  seed?: number;
  profile: 'development' | 'demo' | 'testing' | 'production';
  options: {
    botCount: number;
    daysOfHistory: number;
    includeErrors: boolean;
    realisticData: boolean;
  };
}

// Main Application State Interface
export interface AppState {
  metadata: GeneratorMetadata;
  user: {
    settings: AppSettings;
    wallet: WalletState;
    preferences: UIPreferences;
  };
  bots: {
    list: Bot[];
    stats: BotStats;
    activities: BotActivity[];
  };
  market: {
    data: MarketData;
    analytics: AnalyticsData;
    pools: DeFiPool[];
  };
  notifications: NotificationState[];
}

// Generator Options for Script
export interface GeneratorOptions {
  profile: 'development' | 'demo' | 'testing' | 'production';
  seed?: number;
  botCount?: number;
  daysOfHistory?: number;
  includeErrors?: boolean;
  realisticData?: boolean;
  outputPath?: string;
}

// State Validation Result
export interface StateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    version: string;
    botCount: number;
    totalActivities: number;
    dataSize: number;
  };
}

// Export types for use in other modules
export type {
  AppState as default,
  GeneratorOptions,
  StateValidationResult,
  GeneratorMetadata,
  UIPreferences,
  WalletState,
  TokenBalance,
  WalletTransaction,
  DeFiPool,
  NotificationState,
  AnalyticsData,
};