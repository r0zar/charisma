/**
 * Real-time data module for Blaze SDK
 * Provides unified hook and provider for real-time prices, balances, and metadata
 * Now using React Context pattern for shared state management
 */

// Main hook and provider
export { useBlaze } from './hooks/useBlaze';
export { BlazeProvider } from './providers/BlazeProvider';

// Types
export type {
  BlazeConfig,
  BlazeData,
  PriceData,
  BalanceData,
  TokenMetadata,
  ServerMessage,
  PriceUpdateMessage,
  PriceBatchMessage,
  BalanceUpdateMessage,
  BalanceBatchMessage,
  MetadataUpdateMessage,
  MetadataBatchMessage,
  ErrorMessage,
  ServerInfoMessage
} from './types';