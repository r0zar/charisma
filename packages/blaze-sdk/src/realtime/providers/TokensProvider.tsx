'use client';

import React, { createContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import usePartySocket from 'partysocket/react';
import { TokensStore } from '../stores/TokensStore';
import type {
  TokensConfig,
  TokensContextType,
  TokensProviderProps,
  UnifiedSubscription,
  EnhancedTokenRecord,
  WebSocketTokenBalance,
  PriceUpdate,
  ActiveSubscription,
  MergedSubscription,
} from '../types/tokens';

// Create the context with undefined default
export const TokensContext = createContext<TokensContextType | undefined>(undefined);

/**
 * TokensProvider - A React component that provides unified real-time token data.
 *
 * This provider establishes a WebSocket connection to the unified tokens party server,
 * manages a shared data store, and coordinates subscriptions from multiple useTokens hooks.
 *
 * Features:
 * - Single WebSocket connection for entire app
 * - Dynamic subscription merging from multiple hooks
 * - Smart data filtering for individual hook requests
 * - Automatic cleanup when components unmount
 */
export const TokensProvider = ({ children }: { children: React.ReactNode }) => {
  const [store] = useState(() => new TokensStore());
  const [storeData, setStoreData] = useState(store.getData());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'static' | 'realtime' | 'disconnected'>('disconnected');

  const lastMessageTimestamp = useRef<number>(Date.now());
  const activeSubscriptions = useRef<Map<string, ActiveSubscription>>(new Map());
  const currentMergedSubscription = useRef<MergedSubscription | null>(null);
  const subscriptionTimeout = useRef<NodeJS.Timeout | null>(null);

  // Determine host based on environment
  const isDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const partyHost = isDev ?
    (typeof window !== 'undefined' ? `${window.location.hostname}:1999` : 'localhost:1999') :
    'charisma-party.r0zar.partykit.dev';

  // Merge all active subscriptions into a single optimal subscription
  const mergeSubscriptions = useCallback((): MergedSubscription => {
    const allUserIds = new Set<string>();
    const allContractIds = new Set<string>();
    let includePrices = false;

    for (const subscription of Array.from(activeSubscriptions.current.values())) {
      if (subscription.config.userIds) {
        subscription.config.userIds.forEach(id => allUserIds.add(id));
      }
      if (subscription.config.contractIds) {
        subscription.config.contractIds.forEach(id => allContractIds.add(id));
      }
      if (subscription.config.includePrices) {
        includePrices = true;
      }
    }

    return {
      userIds: Array.from(allUserIds),
      contractIds: Array.from(allContractIds),
      includePrices
    };
  }, []);

  // Determine connection mode based on merged subscriptions
  const determineConnectionMode = useCallback((merged: MergedSubscription): 'static' | 'realtime' => {
    // Real-time if we have userIds (balance tracking) or includePrices
    if (merged.userIds.length > 0) {
      return 'realtime';
    }
    if (merged.contractIds.length > 0 && merged.includePrices) {
      return 'realtime';
    }
    // Otherwise it's a static metadata lookup
    return 'static';
  }, []);

  // Filter store data for a specific hook's config
  const filterDataForConfig = useCallback((config: TokensConfig, data: typeof storeData) => {
    const filtered = {
      metadata: {} as Record<string, EnhancedTokenRecord>,
      balances: {} as Record<string, WebSocketTokenBalance>,
      prices: {} as Record<string, PriceUpdate>
    };

    // Filter metadata
    if (config.contractIds) {
      config.contractIds.forEach(contractId => {
        if (data.metadata.has(contractId)) {
          filtered.metadata[contractId] = data.metadata.get(contractId)!;
        }
      });
    }

    // Filter balances  
    if (config.userIds) {
      for (const [key, balance] of Object.entries(data.balances)) {
        const userId = key.split(':')[0];
        if (config.userIds.includes(userId!)) {
          filtered.balances[key] = balance;
          // Also include metadata for tokens this user holds
          if (data.metadata.has(balance.mainnetContractId)) {
            filtered.metadata[balance.mainnetContractId] = data.metadata.get(balance.mainnetContractId)!;
          }
        }
      }
    }

    // Filter prices
    if (config.includePrices) {
      if (config.contractIds) {
        // Specific tokens
        config.contractIds.forEach(contractId => {
          if (data.prices.has(contractId)) {
            filtered.prices[contractId] = data.prices.get(contractId)!;
          }
        });
      } else if (config.userIds) {
        // Prices for tokens the user holds
        for (const [key, balance] of Object.entries(data.balances)) {
          const userId = key.split(':')[0];
          if (config.userIds.includes(userId!) && data.prices.has(balance.mainnetContractId)) {
            filtered.prices[balance.mainnetContractId] = data.prices.get(balance.mainnetContractId)!;
          }
        }
      }
    }

    return filtered;
  }, []);

  // Send subscription to server based on merged subscriptions - will be updated after socket creation
  const sendMergedSubscriptionRef = useRef<(socketRef: WebSocket) => void>(() => { });

  // Create WebSocket connection first to avoid hoisting issues
  const socket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'tokens',
    onOpen: () => {
      console.log('✅ TokensProvider: Connected to unified tokens server');
      setIsConnected(true);

      // Send merged subscription if we have active subscriptions
      if (activeSubscriptions.current.size > 0 && sendMergedSubscriptionRef.current) {
        sendMergedSubscriptionRef.current(socket as any);
      }
    },
    onClose: () => {
      console.log('🔌 TokensProvider: Disconnected from tokens server');
      setIsConnected(false);
      setConnectionMode('disconnected');
      currentMergedSubscription.current = null;

      // RACE CONDITION FIX: Cancel any pending subscription updates on disconnect
      if (subscriptionTimeout.current) {
        clearTimeout(subscriptionTimeout.current);
        subscriptionTimeout.current = null;
      }
    },
    onError: (error) => {
      console.error('❌ TokensProvider: WebSocket error:', error);
    },
    onMessage: (event) => {
      try {
        const message = JSON.parse(event.data);
        store.handleMessage(message);
        lastMessageTimestamp.current = Date.now();
      } catch (error) {
        console.error('TokensProvider: Error parsing message', error);
      }
    },
  });

  // Define the send subscription function now that socket is available
  sendMergedSubscriptionRef.current = useCallback((socketRef: WebSocket) => {
    if (!socketRef || socketRef.readyState !== WebSocket.OPEN) {
      return;
    }

    const merged = mergeSubscriptions();
    const mode = determineConnectionMode(merged);

    // Skip if no meaningful subscription
    if (merged.userIds.length === 0 && merged.contractIds.length === 0) {
      return;
    }

    // Skip if subscription hasn't changed
    if (currentMergedSubscription.current &&
      JSON.stringify(currentMergedSubscription.current) === JSON.stringify(merged)) {
      return;
    }

    setConnectionMode(mode);
    currentMergedSubscription.current = merged;

    const subscription: UnifiedSubscription = {
      type: 'SUBSCRIBE',
      userIds: merged.userIds.length > 0 ? merged.userIds : undefined,
      contractIds: merged.contractIds.length > 0 ? merged.contractIds : undefined,
      includePrices: merged.includePrices || undefined
    };

    console.log(`📊 TokensProvider: Sending ${mode} subscription:`, subscription);
    socketRef.send(JSON.stringify(subscription));
  }, [mergeSubscriptions, determineConnectionMode]);

  // Debounced subscription sending with race condition protection
  const debouncedSendSubscription = useCallback(() => {
    // Clear any existing timeout
    if (subscriptionTimeout.current) {
      clearTimeout(subscriptionTimeout.current);
      subscriptionTimeout.current = null;
    }

    // Set new timeout with race condition protection
    subscriptionTimeout.current = setTimeout(() => {
      // RACE CONDITION FIX: Check if socket is still open and we still have active subscriptions
      if (socket && socket.readyState === WebSocket.OPEN && activeSubscriptions.current.size > 0 && sendMergedSubscriptionRef.current) {
        sendMergedSubscriptionRef.current(socket as any);
      } else if (activeSubscriptions.current.size === 0) {
        // Send UNSUBSCRIBE if no active subscriptions remain
        if (socket && socket.readyState === WebSocket.OPEN && currentMergedSubscription.current) {
          console.log('📊 TokensProvider: Sending UNSUBSCRIBE (no active subscriptions)');
          socket.send(JSON.stringify({ type: 'UNSUBSCRIBE' }));
          currentMergedSubscription.current = null;
          setConnectionMode('disconnected');
        }
      }
      subscriptionTimeout.current = null;
    }, 100); // 100ms debounce
  }, [socket]);

  // Functions for hooks to register/unregister subscriptions
  const addSubscription = useCallback((id: string, config: TokensConfig) => {
    // RACE CONDITION FIX: Only add subscription if provider is still connected or connecting
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      activeSubscriptions.current.set(id, {
        id,
        config,
        timestamp: Date.now()
      });

      console.log(`📝 TokensProvider: Added subscription ${id}:`, config);
      debouncedSendSubscription();
    } else {
      console.warn(`⚠️ TokensProvider: Cannot add subscription ${id} - socket not available`);
    }
  }, [debouncedSendSubscription, socket]);

  const removeSubscription = useCallback((id: string) => {
    const wasRemoved = activeSubscriptions.current.delete(id);

    if (wasRemoved) {
      console.log(`🗑️ TokensProvider: Removed subscription ${id}`);
      // RACE CONDITION FIX: Only send update if socket is still available
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        debouncedSendSubscription();
      }
    }
  }, [debouncedSendSubscription, socket]);

  const getFilteredData = useCallback((id: string) => {
    const subscription = activeSubscriptions.current.get(id);
    if (!subscription) {
      return {
        metadata: {},
        balances: {},
        prices: {},
        isLoading: false,
        subscriptionId: id
      };
    }

    const filtered = filterDataForConfig(subscription.config, storeData);

    // Determine if this specific subscription is loading
    const isLoading = isConnected && activeSubscriptions.current.size > 0 &&
      (Object.keys(filtered.metadata).length === 0 &&
        Object.keys(filtered.balances).length === 0 &&
        Object.keys(filtered.prices).length === 0);

    return {
      ...filtered,
      isLoading,
      subscriptionId: id
    };
  }, [storeData, isConnected, filterDataForConfig]);

  // Effect to subscribe to store updates
  useEffect(() => {
    const handleUpdate = () => {
      setStoreData(store.getData());
    };

    store.on('update', handleUpdate);
    return () => {
      store.off('update', handleUpdate);
    };
  }, [store]);

  // Effect to cleanup subscription timeout on component unmount
  useEffect(() => {
    return () => {
      // RACE CONDITION FIX: Cancel any pending subscription updates on provider unmount
      if (subscriptionTimeout.current) {
        clearTimeout(subscriptionTimeout.current);
        subscriptionTimeout.current = null;
      }
    };
  }, []);

  // Helper functions that work with the full store data
  const getTokenMetadata = useCallback((contractId: string): EnhancedTokenRecord | undefined => {
    return store.getTokenMetadata(contractId);
  }, [store]);

  const getUserBalance = useCallback((userId: string, contractId: string): WebSocketTokenBalance | undefined => {
    return store.getUserBalance(userId, contractId);
  }, [store]);

  const getTokenPrice = useCallback((contractId: string): PriceUpdate | undefined => {
    return store.getTokenPrice(contractId);
  }, [store]);

  const getUserPortfolio = useCallback((userId: string) => {
    return store.getUserPortfolio(userId);
  }, [store]);

  // Context value with subscription management functions
  const contextValue: TokensContextType = {
    // These are placeholder values - real data comes from getFilteredData in hooks
    metadata: {},
    balances: {},
    prices: {},
    isConnected,
    isLoading: false, // Individual hooks determine their own loading state
    lastUpdate: storeData.lastUpdate,
    connectionMode,
    subscriptionId: '', // Individual hooks provide their own ID
    getTokenMetadata,
    getUserBalance,
    getTokenPrice,
    getUserPortfolio,
    // Internal subscription management (used by hooks)
    _internal: {
      addSubscription,
      removeSubscription,
      getFilteredData
    }
  } as any; // Type assertion needed for internal functions

  return (
    <TokensContext.Provider value={contextValue}>
      {children}
    </TokensContext.Provider>
  );
};