/**
 * Real-time data types for Blaze SDK
 * Uses shared interfaces from ../types/shared.ts for consistency
 *
 * 🚧 MIGRATION PLAN: Legacy Fields to Structured Metadata
 * =====================================================
 * 
 * This file contains interfaces that are currently in a transitional state.
 * We've moved from scattered metadata fields to a structured `metadata` object
 * that includes enriched token information with price data from /api/token-summaries.
 *
 * CURRENT STATE (COMPLETED):
 * - ✅ Added structured `metadata: TokenMetadata` field to BalanceData
 * - ✅ Socket server now enriches all balance messages with complete token metadata + price data
 * - ✅ BlazeProvider transforms messages to include both structured metadata AND legacy fields
 * - ✅ Legacy fields marked as @deprecated for gradual migration
 * - ✅ Client components updated to prefer metadata but fallback to legacy fields
 *
 * FUTURE MIGRATION STEPS:
 * 1. Audit all components using BalanceData to migrate from legacy fields to metadata
 *    - Search for usage of: balance.name, balance.symbol, balance.decimals, etc.
 *    - Replace with: balance.metadata.name, balance.metadata.symbol, etc.
 *    - Update TypeScript types to remove "?" from metadata field (make it required)
 *
 * 2. Remove legacy field population from BlazeProvider (BlazeProvider.tsx):
 *    - Remove lines populating name, symbol, decimals, etc. in BALANCE_UPDATE case
 *    - Remove lines populating name, symbol, decimals, etc. in BALANCE_BATCH case
 *    - Only keep structured metadata transformation
 *
 * 3. Remove legacy fields from interfaces:
 *    - Remove all @deprecated fields from BalanceData interface
 *    - Remove all @deprecated fields from BalanceUpdateMessage interface
 *    - Make metadata field required (remove ?)
 *
 * 4. Update socket server message creation (balances-lib.ts):
 *    - Remove legacy field population in createBalanceUpdateMessage()
 *    - Only include structured metadata in messages
 *
 * 5. Test thoroughly:
 *    - Ensure all components display token info correctly
 *    - Verify price data is accessible via metadata.price, metadata.change24h, etc.
 *    - Confirm USD values and price changes display properly
 *
 * BENEFITS OF COMPLETED MIGRATION:
 * - Cleaner, more maintainable interfaces
 * - Reduced duplication and bundle size
 * - Centralized token metadata with enriched price data
 * - Type safety improvements
 * - Better performance (fewer redundant fields)
 *
 * NOTE: Do not remove legacy fields until ALL consuming components are migrated!
 */

import { TokenMetadata, PriceData, EnhancedBalanceData } from '../types/shared';

// Re-export shared interfaces for backward compatibility
export type { TokenMetadata, PriceData, EnhancedBalanceData };

// Updated BalanceData interface with structured metadata
export interface BalanceData {
  // Core balance fields
  balance: string;
  totalSent: string;
  totalReceived: string;
  formattedBalance: number;
  timestamp: number;
  source: string;

  // Subnet balance fields
  subnetBalance?: number;
  formattedSubnetBalance?: number;
  subnetContractId?: string;

  // Structured metadata (includes price data, market data, etc.)
  metadata: TokenMetadata;

  // Legacy fields for backward compatibility (deprecated - use metadata instead)
  /** @deprecated Use metadata.name instead */
  name?: string;
  /** @deprecated Use metadata.symbol instead */
  symbol?: string;
  /** @deprecated Use metadata.decimals instead */
  decimals?: number;
  /** @deprecated Use metadata.description instead */
  description?: string | null;
  /** @deprecated Use metadata.image instead */
  image?: string | null;
  /** @deprecated Use metadata.total_supply instead */
  total_supply?: string | null;
  /** @deprecated Use metadata.type instead */
  type?: string;
  /** @deprecated Use metadata.identifier instead */
  identifier?: string;
  /** @deprecated Use metadata.token_uri instead */
  token_uri?: string | null;
  /** @deprecated Use metadata.lastUpdated instead */
  lastUpdated?: number | null;
  /** @deprecated Use metadata.tokenAContract instead */
  tokenAContract?: string | null;
  /** @deprecated Use metadata.tokenBContract instead */
  tokenBContract?: string | null;
  /** @deprecated Use metadata.lpRebatePercent instead */
  lpRebatePercent?: number | null;
  /** @deprecated Use metadata.externalPoolId instead */
  externalPoolId?: string | null;
  /** @deprecated Use metadata.engineContractId instead */
  engineContractId?: string | null;
  /** @deprecated Use metadata.base instead */
  base?: string | null;
}

// Configuration for useBlaze hook
export interface BlazeConfig {
  userId?: string | null; // Subscribe to all balances for this user (can be null/undefined)
  userIds?: string[] | null; // Subscribe to all balances for these users (can be null/undefined)
  contractIds?: string[] | null; // Subscribe to all balances for these contractIds (can be null/undefined)
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

  // Core balance data
  balance: number;
  totalSent: string;
  totalReceived: string;
  formattedBalance: number;
  timestamp: number;
  source: string;

  // Subnet balance fields
  subnetBalance?: number;
  formattedSubnetBalance?: number;
  subnetContractId?: string;

  // Complete token metadata (includes price data, market data, etc.)
  metadata: TokenMetadata;

  // Legacy fields for backward compatibility (deprecated - use metadata instead)
  /** @deprecated Use metadata.name instead */
  name?: string;
  /** @deprecated Use metadata.symbol instead */
  symbol?: string;
  /** @deprecated Use metadata.decimals instead */
  decimals?: number;
  /** @deprecated Use metadata.description instead */
  description?: string | null;
  /** @deprecated Use metadata.image instead */
  image?: string | null;
  /** @deprecated Use metadata.total_supply instead */
  total_supply?: string | null;
  /** @deprecated Use metadata.type instead */
  tokenType?: string;
  /** @deprecated Use metadata.identifier instead */
  identifier?: string;
  /** @deprecated Use metadata.token_uri instead */
  token_uri?: string | null;
  /** @deprecated Use metadata.lastUpdated instead */
  lastUpdated?: number | null;
  /** @deprecated Use metadata.tokenAContract instead */
  tokenAContract?: string | null;
  /** @deprecated Use metadata.tokenBContract instead */
  tokenBContract?: string | null;
  /** @deprecated Use metadata.lpRebatePercent instead */
  lpRebatePercent?: number | null;
  /** @deprecated Use metadata.externalPoolId instead */
  externalPoolId?: string | null;
  /** @deprecated Use metadata.engineContractId instead */
  engineContractId?: string | null;
  /** @deprecated Use metadata.base instead */
  baseToken?: string | null;
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
  isInitialized: boolean;

  // Utility functions
  getPrice: (contractId: string) => number | undefined;
  getBalance: (userId: string, contractId: string) => BalanceData | undefined;
  getMetadata: (contractId: string) => TokenMetadata | undefined;

  // User-specific helper (returns filtered balances for the current user)
  getUserBalances: (userId?: string | null) => Record<string, BalanceData>;
}