/**
 * Token Types for Blaze SDK
 * 
 * This file defines types for the unified tokens functionality including
 * balance and price data with a clean subscription model.
 */

import type { TokenMetadata, BalanceUpdateMessage } from '../types';

/**
 * Enhanced token record interface - includes metadata and balances
 */
export interface EnhancedTokenRecord extends TokenMetadata {
  userBalances: Record<string, {
    balance: number;
    totalSent: string;
    totalReceived: string;
    formattedBalance: number;
    timestamp: number;
    source: string;
  }>;
  timestamp: number;
  metadataSource: string;
}

/**
 * WebSocket token balance structure
 */
export interface WebSocketTokenBalance {
  balance: number;
  totalSent: string;
  totalReceived: string;
  formattedBalance: number;
  timestamp: number;
  source: string;
  contractId: string;
  mainnetContractId: string;
  subnetBalance?: number;
  subnetTotalSent?: string;
  subnetTotalReceived?: string;
  subnetFormattedBalance?: number;
  subnetContractId?: string;
}

/**
 * User balance information
 */
export interface UserBalanceInfo {
  balance: number;
  totalSent: string;
  totalReceived: string;
  formattedBalance: number;
  timestamp: number;
  source: string;
}

/**
 * Subnet balance information
 */
export interface SubnetBalanceInfo {
  contractId: string;
  balance: number;
  totalSent: string;
  totalReceived: string;
  formattedBalance: number;
  timestamp: number;
  source: string;
}

/**
 * Price update message structure
 */
export interface PriceUpdate {
  type: 'PRICE_UPDATE';
  contractId: string;
  price: number;
  timestamp: number;
  source?: string;
}

/**
 * Token metadata response message
 */
export interface TokenMetadataMessage {
  type: 'TOKEN_METADATA';
  contractId: string;
  metadata: EnhancedTokenRecord;
  currentPrice?: PriceUpdate;
  timestamp: number;
}

/**
 * User portfolio discovery message
 */
export interface UserPortfolioMessage {
  type: 'USER_PORTFOLIO';
  userId: string;
  tokens: TokenMetadataMessage[];
  balances?: any[];
  timestamp: number;
}

/**
 * Batch message types
 */
export interface TokenBatchMessage {
  type: 'TOKEN_BATCH';
  metadata?: TokenMetadataMessage[];
  balances?: any[];
  prices?: PriceUpdate[];
  timestamp: number;
}

/**
 * Unified subscription model
 */
export interface UnifiedSubscription {
  type: 'SUBSCRIBE' | 'UNSUBSCRIBE';
  userIds?: string[];
  contractIds?: string[];
  includePrices?: boolean;
  clientId?: string;
}

/**
 * Server info message for unified server
 */
export interface UnifiedServerInfo {
  type: 'SERVER_INFO';
  party: 'tokens';
  isLocalDev: boolean;
  metadataLoaded: boolean;
  metadataCount: number;
  priceCount: number;
  balanceCount: number;
  activeSubscriptions: number;
  totalClients: number;
  uptime: number;
  timestamp: number;
}


/**
 * Configuration for the useTokens hook
 */
export interface TokensConfig {
  contractIds?: string[];    // Token contract IDs for metadata lookup
  userIds?: string[];        // User IDs for portfolio discovery
  includePrices?: boolean;   // Whether to include real-time price updates
}

/**
 * Data returned by the useTokens hook
 */
export interface TokensData {
  metadata: Record<string, EnhancedTokenRecord>;
  balances: Record<string, WebSocketTokenBalance>;
  prices: Record<string, PriceUpdate>;
  isConnected: boolean;
  isLoading: boolean;
  lastUpdate: number;
  connectionMode: 'static' | 'realtime' | 'disconnected';
  subscriptionId: string; // Unique ID for this hook's subscription
}

/**
 * Helper functions provided by the useTokens hook
 */
export interface TokensHelpers {
  getTokenMetadata: (contractId: string) => EnhancedTokenRecord | undefined;
  getUserBalance: (userId: string, contractId: string) => WebSocketTokenBalance | undefined;
  getTokenPrice: (contractId: string) => PriceUpdate | undefined;
  getUserPortfolio: (userId: string) => {
    tokens: EnhancedTokenRecord[];
    balances: WebSocketTokenBalance[];
    totalValueUSD?: number;
  };
}

/**
 * Complete return type for the useTokens hook
 */
export interface UseTokensReturn extends TokensData, TokensHelpers { }

/**
 * Context type for the TokensProvider
 */
export interface TokensContextType extends UseTokensReturn {
  // Internal subscription management functions (used by hooks)
  _internal: {
    addSubscription: (id: string, config: TokensConfig) => void;
    removeSubscription: (id: string) => void;
    getFilteredData: (id: string) => {
      metadata: Record<string, EnhancedTokenRecord>;
      balances: Record<string, WebSocketTokenBalance>;
      prices: Record<string, PriceUpdate>;
      isLoading: boolean;
      subscriptionId: string;
    };
  };
}

/**
 * Props for the TokensProvider component
 */
export interface TokensProviderProps {
  children: React.ReactNode;
}

/**
 * Subscription manager types
 */
export interface ActiveSubscription {
  id: string;
  config: TokensConfig;
  timestamp: number;
}

export interface MergedSubscription {
  userIds: string[];
  contractIds: string[];
  includePrices: boolean;
}

/**
 * Internal message types for the TokensStore
 */
export type TokensMessage =
  | TokenMetadataMessage
  | UserPortfolioMessage
  | TokenBatchMessage
  | PriceUpdate
  | BalanceUpdateMessage
  | UnifiedServerInfo
  | UnifiedSubscription
  | { type: 'ERROR'; message: string }
  | { type: 'PONG'; timestamp: number }
  | { type: 'PING'; timestamp?: number }
  | { type: 'MANUAL_UPDATE' }
  | { type: 'PRICE_BATCH'; prices: PriceUpdate[]; timestamp: number };

/**
 * Store data structure
 */
export interface TokensStoreData {
  metadata: Map<string, EnhancedTokenRecord>;
  balances: Map<string, WebSocketTokenBalance>;
  prices: Map<string, PriceUpdate>;
  lastUpdate: number;
}