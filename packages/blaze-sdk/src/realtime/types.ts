/**
 * Real-time data types for Blaze SDK
 * Extends existing protocol types with real-time capabilities
 */

import { BalanceData } from '../balances';

// Core real-time data interfaces
export interface PriceData {
  contractId: string;
  price: number;
  timestamp: number;
  source?: string;
}

export interface RealtimeBalanceData extends BalanceData {
  timestamp: number;
  source: 'realtime' | 'protocol';
}

export interface TokenMetadata {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  imageUrl?: string;
  verified: boolean;
  timestamp: number;
}

// Subscription interfaces
export interface BlazeSubscription {
  prices?: string[];
  balances?: { 
    userId: string; 
    tokens: string[];
    fallbackToProtocol?: boolean;
  };
  metadata?: string[];
}

// Store interfaces
export interface PricesStore {
  prices: Record<string, PriceData>;
  subscribedTokens: Set<string>;
  isConnected: boolean;
  lastUpdate: number;

  // Actions
  getPrice: (contractId: string) => number | undefined;
  formatPrice: (contractId: string) => string;
  _updatePrice: (contractId: string, price: number, timestamp: number, source?: string) => void;
  _setConnectionStatus: (connected: boolean) => void;
  _addSubscription: (contractIds: string[]) => void;
  _removeSubscription: (contractIds: string[]) => void;
}

export interface BalancesStore {
  balances: Record<string, RealtimeBalanceData>;
  subscribedUserTokens: Map<string, Set<string>>; // userId -> Set<contractId>
  isConnected: boolean;
  lastUpdate: number;

  // Actions
  getBalance: (userId: string, contractId: string) => RealtimeBalanceData | undefined;
  _updateBalance: (userId: string, contractId: string, balance: RealtimeBalanceData) => void;
  _setConnectionStatus: (connected: boolean) => void;
  _addSubscription: (userId: string, contractIds: string[]) => void;
  _removeSubscription: (userId: string, contractIds: string[]) => void;
}

export interface MetadataStore {
  metadata: Record<string, TokenMetadata>;
  subscribedTokens: Set<string>;
  isConnected: boolean;
  lastUpdate: number;

  // Actions
  getMetadata: (contractId: string) => TokenMetadata | undefined;
  _updateMetadata: (contractId: string, metadata: TokenMetadata) => void;
  _setConnectionStatus: (connected: boolean) => void;
  _addSubscription: (contractIds: string[]) => void;
  _removeSubscription: (contractIds: string[]) => void;
}

// WebSocket message types
export interface PriceUpdateMessage {
  type: 'PRICE_UPDATE';
  contractId: string;
  price: number;
  timestamp: number;
  source?: string;
}

export interface PriceBatchMessage {
  type: 'PRICE_BATCH';
  prices: PriceData[];
  timestamp: number;
}

export interface BalanceUpdateMessage {
  type: 'BALANCE_UPDATE';
  userId: string;
  contractId: string;
  balance: RealtimeBalanceData;
}

export interface MetadataUpdateMessage {
  type: 'METADATA_UPDATE';
  contractId: string;
  metadata: TokenMetadata;
}

export interface ErrorMessage {
  type: 'ERROR';
  message: string;
}

export interface ServerInfoMessage {
  type: 'SERVER_INFO';
  isLocalDev: boolean;
  timestamp: number;
}

export type ServerMessage = 
  | PriceUpdateMessage
  | PriceBatchMessage
  | BalanceUpdateMessage
  | MetadataUpdateMessage
  | ErrorMessage
  | ServerInfoMessage;

// Hook return types
export interface BlazeData {
  prices: Record<string, PriceData>;
  balances: Record<string, RealtimeBalanceData>;
  metadata: Record<string, TokenMetadata>;
  isConnected: boolean;
  lastUpdate: number;

  // Utility functions
  getPrice: (contractId: string) => number | undefined;
  formatPrice: (contractId: string) => string;
  getBalance: (userId: string, contractId: string) => RealtimeBalanceData | undefined;
  getSmartBalance: (userId: string, contractId: string) => Promise<RealtimeBalanceData | undefined>;
  getMetadata: (contractId: string) => TokenMetadata | undefined;
}

// Provider configuration
export interface BlazeProviderConfig {
  host?: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}