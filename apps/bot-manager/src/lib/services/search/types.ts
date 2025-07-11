/**
 * Search Service Types
 * Types and interfaces for the global search functionality
 */

import { Bot } from '@/schemas/bot.schema';
import { StoredNotification } from '@/schemas/notification.schema';
import { WalletTransaction } from '@/schemas/wallet.schema';

export type SearchResultType = 'bot' | 'notification' | 'user' | 'transaction';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  description: string;
  metadata?: Record<string, any>;
  score: number;
  data: any; // The original data object
}

export interface BotSearchResult extends SearchResult {
  type: 'bot';
  data: Bot;
  metadata: {
    status: string;
    ownerId: string;
    strategyType?: string;
    lastActive: string;
  };
}

export interface NotificationSearchResult extends SearchResult {
  type: 'notification';
  data: StoredNotification;
  metadata: {
    notificationType: string;
    category?: string;
    priority?: string;
    read: boolean;
    timestamp: string;
  };
}

export interface UserSearchResult extends SearchResult {
  type: 'user';
  data: {
    userId: string;
    address: string;
    connectionMethod?: string;
    network?: string;
    lastActive?: string;
  };
  metadata: {
    walletAddress: string;
    connectionStatus: string;
    network?: string;
  };
}

export interface TransactionSearchResult extends SearchResult {
  type: 'transaction';
  data: WalletTransaction;
  metadata: {
    txId: string;
    type: string;
    amount: number;
    token: string;
    status: string;
    timestamp: string;
  };
}

export interface SearchResults {
  bots: BotSearchResult[];
  notifications: NotificationSearchResult[];
  users: UserSearchResult[];
  transactions: TransactionSearchResult[];
  totalResults: number;
  query: string;
  searchTime: number;
}

export interface SearchOptions {
  maxResults?: number;
  categories?: SearchResultType[];
  fuzzyThreshold?: number;
  includeInactive?: boolean;
}

export interface SearchQuery {
  query: string;
  options?: SearchOptions;
}