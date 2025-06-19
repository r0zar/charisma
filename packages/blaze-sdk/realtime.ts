/**
 * Real-time data module for Blaze SDK - Browser-safe exports
 * This file exports only the realtime functionality without crypto dependencies
 */

// Main hook and provider
export { useBlaze } from './src/realtime/hooks/useBlaze';
export { BlazeProvider } from './src/realtime/providers/BlazeProvider';

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
} from './src/realtime/types';