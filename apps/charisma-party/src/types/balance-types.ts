/**
 * Balance Types for Charisma Party
 * 
 * This file defines types to prevent confusion between different balance data formats
 * and ensure consistent field naming across websocket and balances-lib.
 */

import type { BalanceUpdateMessage, TokenMetadata } from 'blaze-sdk/realtime';
import type { EnhancedTokenRecord } from '../balances-lib';

/**
 * Raw balance data from Hiro API (what fetchUserBalances returns)
 */
export interface RawBalanceData {
  userId: string;
  contractId: string;
  balance: number;
  totalSent: string;
  totalReceived: string;
  timestamp: number;
  source: 'hiro-api' | 'subnet-contract-call';
}

/**
 * Internal websocket party storage format
 * One entry per mainnet token per user, with optional subnet data
 */
export interface WebSocketTokenBalance {
  userId: string;
  mainnetContractId: string;
  mainnetBalance: number;
  mainnetTotalSent: string;
  mainnetTotalReceived: string;
  subnetBalance?: number;
  subnetTotalSent?: string;
  subnetTotalReceived?: string;
  subnetContractId?: string;
  lastUpdated: number;
}

/**
 * Enhanced token record from balances-lib (extends TokenMetadata)
 * CRITICAL: Uses 'type' and 'base' fields, NOT 'tokenType' and 'baseToken'
 * 
 * NOTE: This is now imported from balances-lib to ensure consistency
 */
export type { EnhancedTokenRecord };

/**
 * Balance data format expected by balances-lib auto-discovery
 */
export interface BalancesLibFormat {
  userId: string;
  contractId: string;
  balance: number;
  totalSent: string;
  totalReceived: string;
  timestamp: number;
  source: string;
}

/**
 * Subnet balance info structure used in balance message creation
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
 * User balance info structure used in balance message creation
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
 * Type guard to check if a token is a subnet token
 */
export function isSubnetToken(token: EnhancedTokenRecord): boolean {
  return token.type === 'SUBNET';
}

/**
 * Type guard to check if a subnet token has a valid base mapping
 */
export function hasValidBaseMapping(
  subnetToken: EnhancedTokenRecord,
  allTokens: Map<string, EnhancedTokenRecord>
): boolean {
  return isSubnetToken(subnetToken) && 
         !!subnetToken.base && 
         typeof subnetToken.base === 'string' &&
         allTokens.has(subnetToken.base);
}

/**
 * Field name mapping documentation to prevent confusion
 */
export const FIELD_NAME_MAPPING = {
  // Correct field names (balances-lib format)
  CORRECT: {
    tokenType: 'type',
    baseToken: 'base'
  },
  
  // Legacy/incorrect field names (old websocket format)
  LEGACY: {
    type: 'tokenType',
    base: 'baseToken'
  }
} as const;

/**
 * Constants for token types
 */
export const TOKEN_TYPES = {
  SIP10: 'SIP10',
  SUBNET: 'SUBNET',
  LP: 'LP'
} as const;

export type TokenType = typeof TOKEN_TYPES[keyof typeof TOKEN_TYPES];

/**
 * Websocket message types
 */
export interface BalanceSubscription {
  type: 'SUBSCRIBE' | 'UNSUBSCRIBE';
  userIds: string[];
  clientId: string;
}

export interface ClientSubscription {
  userIds: Set<string>;
  lastSeen: number;
  subscribeToAll: boolean;
}