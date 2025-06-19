/**
 * useBlaze - Context-based hook for real-time price and balance data
 * Now uses BlazeProvider for shared connections and state management
 */

import { useBlaze as useBlazeContext } from '../providers/BlazeProvider';
import type { BlazeConfig, BlazeData } from '../types';

/**
 * Hook to access real-time price and balance data
 * @param config Optional configuration for balance subscriptions
 * @returns BlazeData with prices, balances, and utility functions
 */
export function useBlaze(config?: BlazeConfig): BlazeData {
  return useBlazeContext(config);
}