/**
 * Real-time data types for Blaze SDK
 * Simplified types for useBlaze context provider
 */

// Core real-time data interfaces
export interface PriceData {
  contractId: string;
  price: number;
  timestamp: number;
  source?: string;
}

export interface BalanceData {
  balance: string;
  totalSent: string;
  totalReceived: string;
  timestamp: number;
  source: string;
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

// Configuration for useBlaze hook
export interface BlazeConfig {
  userId?: string; // Subscribe to all balances for this user
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
  balance: string;
  totalSent: string;
  totalReceived: string;
  timestamp: number;
  source: string;
}

export interface BalanceBatchMessage {
  type: 'BALANCE_BATCH';
  balances: BalanceUpdateMessage[];
  timestamp: number;
}

export interface MetadataUpdateMessage {
  type: 'METADATA_UPDATE';
  contractId: string;
  metadata: TokenMetadata;
}

export interface MetadataBatchMessage {
  type: 'METADATA_BATCH';
  metadata: MetadataUpdateMessage[];
  timestamp: number;
}

export interface ErrorMessage {
  type: 'ERROR';
  message: string;
}

export interface ServerInfoMessage {
  type: 'SERVER_INFO';
  party: string;
  isLocalDev: boolean;
  timestamp: number;
}

export type ServerMessage = 
  | PriceUpdateMessage
  | PriceBatchMessage
  | BalanceUpdateMessage
  | BalanceBatchMessage
  | MetadataUpdateMessage
  | MetadataBatchMessage
  | ErrorMessage
  | ServerInfoMessage;

// Hook return types
export interface BlazeData {
  prices: Record<string, PriceData>;
  balances: Record<string, BalanceData>;
  metadata: Record<string, TokenMetadata>;
  isConnected: boolean;
  lastUpdate: number;

  // Utility functions
  getPrice: (contractId: string) => number | undefined;
  getBalance: (userId: string, contractId: string) => BalanceData | undefined;
  getMetadata: (contractId: string) => TokenMetadata | undefined;
}