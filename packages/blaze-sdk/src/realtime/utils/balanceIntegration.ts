/**
 * Integration utilities for bridging real-time and protocol balance data
 */

import { getUserTokenBalance } from '../../balances';
import { RealtimeBalanceData } from '../types';

/**
 * Fallback to protocol balance when real-time data is unavailable
 * 
 * @param userId - User address
 * @param contractId - Token contract ID
 * @returns Promise resolving to RealtimeBalanceData or undefined
 */
export async function getProtocolBalance(
  userId: string, 
  contractId: string
): Promise<RealtimeBalanceData | undefined> {
  try {
    const balance = await getUserTokenBalance(userId, contractId);
    
    if (balance) {
      // Convert protocol BalanceData to RealtimeBalanceData
      const realtimeBalance: RealtimeBalanceData = {
        ...balance,
        timestamp: Date.now(),
        source: 'protocol' as const
      };
      
      return realtimeBalance;
    }
  } catch (error) {
    console.error('Failed to fetch protocol balance:', error);
  }
  
  return undefined;
}

/**
 * Smart balance getter that prefers real-time but falls back to protocol
 * 
 * @param realtimeBalance - Real-time balance if available
 * @param userId - User address for protocol fallback
 * @param contractId - Token contract ID for protocol fallback
 * @param fallbackToProtocol - Whether to fallback to protocol calls
 * @returns Promise resolving to the best available balance data
 */
export async function getSmartBalance(
  realtimeBalance: RealtimeBalanceData | undefined,
  userId: string,
  contractId: string,
  fallbackToProtocol: boolean = false
): Promise<RealtimeBalanceData | undefined> {
  // If we have recent real-time data, use it
  if (realtimeBalance && (Date.now() - realtimeBalance.timestamp) < 30000) { // 30 seconds
    return realtimeBalance;
  }
  
  // If fallback is enabled and we don't have real-time data, use protocol
  if (fallbackToProtocol) {
    return await getProtocolBalance(userId, contractId);
  }
  
  // Otherwise return the real-time data even if it's stale
  return realtimeBalance;
}