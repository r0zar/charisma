import { useContext, useEffect, useRef, useState, useMemo } from 'react';
import { TokensContext } from '../providers/TokensProvider';
import type { UseTokensReturn, TokensConfig } from '../types/tokens';

/**
 * useTokens - The primary hook for accessing unified real-time token data.
 *
 * This hook provides access to token metadata, user balances, and token prices
 * from the unified tokens party server. Each hook instance manages its own subscription
 * to the server and receives filtered data based on its configuration.
 *
 * @param config - Optional configuration for this hook's subscription
 * @param config.contractIds - Token contract IDs for metadata lookup
 * @param config.userIds - User IDs for portfolio discovery and balance tracking
 * @param config.includePrices - Whether to include real-time price updates
 *
 * @example
 * // 1. Token metadata lookup (static)
 * const { metadata, isLoading } = useTokens({ 
 *   contractIds: ['SP1ABC.token', 'SP1DEF.token'] 
 * });
 *
 * @example  
 * // 2. User portfolio auto-discovery (real-time balances)
 * const { balances, metadata, isLoading } = useTokens({ 
 *   userIds: ['SP1USER...'] 
 * });
 *
 * @example
 * // 3. Full portfolio with prices (real-time everything)
 * const { balances, prices, metadata, getUserPortfolio } = useTokens({ 
 *   userIds: ['SP1USER...'], 
 *   includePrices: true 
 * });
 *
 * @example
 * // 4. Price tracking for specific tokens (real-time prices)
 * const { prices, metadata, getTokenPrice } = useTokens({ 
 *   contractIds: ['SP1ABC.token'], 
 *   includePrices: true 
 * });
 *
 * @returns {UseTokensReturn} An object containing filtered data and helper functions
 */
export const useTokens = (config?: TokensConfig): UseTokensReturn => {
  const context = useContext(TokensContext);

  if (context === undefined) {
    throw new Error('useTokens must be used within a TokensProvider');
  }

  // Generate unique subscription ID for this hook instance
  const subscriptionId = useRef<string>(`tokens_${Math.random().toString(36).substr(2, 9)}`).current;
  
  // Track current config to detect changes
  const configRef = useRef<TokensConfig | undefined>(config);
  const [filteredData, setFilteredData] = useState(() => {
    return context._internal.getFilteredData(subscriptionId);
  });

  // Stable config comparison using JSON serialization with sorted keys
  const configHash = useMemo(() => {
    if (!config) return 'undefined';
    
    // Create a stable hash by sorting keys
    const sortedConfig = {
      contractIds: config.contractIds?.slice().sort(),
      userIds: config.userIds?.slice().sort(), 
      includePrices: config.includePrices
    };
    
    return JSON.stringify(sortedConfig);
  }, [
    config?.contractIds?.join(','),
    config?.userIds?.join(','), 
    config?.includePrices
  ]);

  // Effect to manage subscription lifecycle
  useEffect(() => {
    if (!config || (!config.contractIds?.length && !config.userIds?.length)) {
      // No meaningful config, remove subscription if it exists
      context._internal.removeSubscription(subscriptionId);
      return;
    }

    // Add or update subscription
    context._internal.addSubscription(subscriptionId, config);
    configRef.current = config;

    // Cleanup on unmount or config change
    return () => {
      // RACE CONDITION FIX: Always try to remove subscription on cleanup
      // The removeSubscription function will handle the case where subscription doesn't exist
      try {
        context._internal.removeSubscription(subscriptionId);
      } catch (error) {
        // Silent fail - subscription may have already been removed
        console.debug(`useTokens cleanup: subscription ${subscriptionId} already removed`);
      }
    };
  }, [configHash, context._internal, subscriptionId]); // Use configHash for stable comparison

  // Effect to update filtered data when store changes
  useEffect(() => {
    const updateData = () => {
      const newData = context._internal.getFilteredData(subscriptionId);
      setFilteredData(newData);
    };

    updateData(); // Initial update

    // Since we can't subscribe to store changes directly from here,
    // we'll rely on the context's lastUpdate changing to trigger re-renders
  }, [context.lastUpdate, context._internal, subscriptionId]);

  // Return the filtered data combined with global helper functions and connection state
  return {
    metadata: filteredData.metadata,
    balances: filteredData.balances,
    prices: filteredData.prices,
    isConnected: context.isConnected,
    isLoading: filteredData.isLoading,
    lastUpdate: context.lastUpdate,
    connectionMode: context.connectionMode,
    subscriptionId: filteredData.subscriptionId,
    getTokenMetadata: context.getTokenMetadata,
    getUserBalance: context.getUserBalance,
    getTokenPrice: context.getTokenPrice,
    getUserPortfolio: context.getUserPortfolio,
  };
};

/**
 * useTokenMetadata - A specialized hook for token metadata lookups.
 * 
 * This is a convenience hook for when you only need metadata and want a cleaner API.
 *
 * @param contractIds - Array of contract IDs to get metadata for
 * @param includePrices - Whether to include current prices (optional)
 * 
 * @example
 * const { metadata, isLoading, getTokenMetadata } = useTokenMetadata([
 *   'SP1ABC.token', 'SP1DEF.token'
 * ]);
 * const tokenInfo = getTokenMetadata('SP1ABC.token');
 */
export const useTokenMetadata = (contractIds?: string[], includePrices?: boolean) => {
  const context = useTokens(contractIds?.length ? { contractIds, includePrices } : undefined);
  
  return {
    metadata: context.metadata,
    prices: context.prices,
    isLoading: context.isLoading,
    isConnected: context.isConnected,
    connectionMode: context.connectionMode,
    getTokenMetadata: context.getTokenMetadata,
    getTokenPrice: context.getTokenPrice,
  };
};

/**
 * useUserBalances - A specialized hook for user balance tracking.
 * 
 * This is a convenience hook for when you only need balance data.
 *
 * @param userIds - Array of user IDs to track balances for
 * @param includePrices - Whether to include current prices for user's tokens (optional)
 * 
 * @example
 * const { balances, metadata, getUserBalance, getUserPortfolio } = useUserBalances([
 *   'SP1USER...', 'SP2USER...'
 * ], true);
 * const userTokens = getUserPortfolio('SP1USER...');
 */
export const useUserBalances = (userIds: string[], includePrices?: boolean) => {
  const context = useTokens({ userIds, includePrices });
  
  return {
    balances: context.balances,
    metadata: context.metadata, // Metadata is often needed with balances
    prices: context.prices,
    isLoading: context.isLoading,
    isConnected: context.isConnected,
    connectionMode: context.connectionMode,
    lastUpdate: context.lastUpdate,
    getUserBalance: context.getUserBalance,
    getUserPortfolio: context.getUserPortfolio,
    getTokenMetadata: context.getTokenMetadata,
    getTokenPrice: context.getTokenPrice,
  };
};

/**
 * useTokenPrices - A specialized hook for token price tracking.
 * 
 * This is a convenience hook for when you only need price data for specific tokens.
 *
 * @param contractIds - Array of contract IDs to track prices for
 * 
 * @example
 * const { prices, metadata, getTokenPrice } = useTokenPrices([
 *   'SP1ABC.token', 'SP1DEF.token'
 * ]);
 * const currentPrice = getTokenPrice('SP1ABC.token');
 */
export const useTokenPrices = (contractIds: string[]) => {
  const context = useTokens({ contractIds, includePrices: true });
  
  return {
    prices: context.prices,
    metadata: context.metadata, // Metadata is often needed with prices
    isLoading: context.isLoading,
    isConnected: context.isConnected,
    connectionMode: context.connectionMode,
    lastUpdate: context.lastUpdate,
    getTokenPrice: context.getTokenPrice,
    getTokenMetadata: context.getTokenMetadata,
  };
};

/**
 * useTokensConnection - A specialized hook for connection status.
 * 
 * This is a utility hook for components that only need to monitor connection status
 * without subscribing to any specific data.
 *
 * @example
 * const { isConnected, isLoading, connectionMode } = useTokensConnection();
 */
export const useTokensConnection = () => {
  const context = useContext(TokensContext);

  if (context === undefined) {
    throw new Error('useTokensConnection must be used within a TokensProvider');
  }
  
  return {
    isConnected: context.isConnected,
    isLoading: context.isLoading,
    connectionMode: context.connectionMode,
    lastUpdate: context.lastUpdate,
  };
};