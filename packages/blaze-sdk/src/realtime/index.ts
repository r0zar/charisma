/**
 * Real-time data module for Blaze SDK
 * Provides unified hook and provider for real-time prices, balances, and metadata
 * Now using React state management instead of Zustand
 */

// Main hook and provider
export { useBlaze } from './hooks/useBlaze';
export { BlazeProvider, useBlazeContext } from './providers/BlazeProvider';

// State management
export { blazeReducer, stateUtils } from './state/reducer';
export type { BlazeState, BlazeAction } from './state/reducer';

// Utilities
export { getProtocolBalance, getSmartBalance } from './utils/balanceIntegration';

// Types
export type {
  BlazeSubscription,
  BlazeData,
  BlazeProviderConfig,
  PriceData,
  RealtimeBalanceData,
  TokenMetadata,
  ServerMessage,
  PriceUpdateMessage,
  PriceBatchMessage,
  BalanceUpdateMessage,
  MetadataUpdateMessage,
  ErrorMessage,
  ServerInfoMessage
} from './types';