'use client';

/**
 * BlazeProvider - Context provider for real-time price and balance data
 * Manages WebSocket connections and provides shared state across components
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo, useCallback } from 'react';
import usePartySocket from 'partysocket/react';
import { BlazeData, BlazeConfig, PriceData, BalanceData, TokenMetadata } from '../types';

interface BlazeContextType extends BlazeData {
  // Internal subscription management
  _subscribeToUserBalances: (userId: string) => void;
  _unsubscribeFromUserBalances: () => void;
}

const BlazeContext = createContext<BlazeContextType | undefined>(undefined);

interface BlazeProviderProps {
  children: ReactNode;
  host?: string;
}

export function BlazeProvider({ children, host }: BlazeProviderProps) {
  // State
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [balances, setBalances] = useState<Record<string, BalanceData>>({});
  const [metadata, setMetadata] = useState<Record<string, TokenMetadata>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [initialPricesLoaded, setInitialPricesLoaded] = useState(false);

  // Track current balance subscriptions
  const currentUserSubscription = useRef<string | null>(null);

  // Determine host based on environment
  const isDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const partyHost = host || (isDev ?
    (typeof window !== 'undefined' ? `${window.location.hostname}:1999` : 'localhost:1999') :
    'charisma-party.r0zar.partykit.dev');

  // Prices socket
  const pricesSocket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'prices',
    onOpen: () => {
      console.log('✅ BlazeProvider: Connected to prices server');
      setIsConnected(true);
      // Subscribe to all prices
      if (pricesSocket) {
        pricesSocket.send(JSON.stringify({
          type: 'SUBSCRIBE',
          contractIds: [], // Empty = subscribe to all
          clientId: 'blaze-provider'
        }));
      }
    },
    onClose: () => {
      console.log('🔌 BlazeProvider: Disconnected from prices server');
      setIsConnected(false);
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'PRICE_UPDATE':
            setPrices(prev => ({
              ...prev,
              [data.contractId]: {
                contractId: data.contractId,
                price: data.price,
                timestamp: data.timestamp,
                source: data.source || 'realtime'
              }
            }));
            setLastUpdate(Date.now());
            break;

          case 'PRICE_BATCH':
            const newPrices: Record<string, PriceData> = {};
            data.prices.forEach((price: any) => {
              newPrices[price.contractId] = {
                contractId: price.contractId,
                price: price.price,
                timestamp: price.timestamp,
                source: price.source || 'realtime'
              };
            });
            setPrices(prev => ({ ...prev, ...newPrices }));
            setLastUpdate(Date.now());
            break;

          case 'SERVER_INFO':
            console.log('BlazeProvider: Prices server info:', data);
            break;

          case 'ERROR':
            console.error('BlazeProvider: Prices server error:', data.message);
            break;
        }
      } catch (error) {
        console.error('BlazeProvider: Error parsing prices message:', error);
      }
    }
  });

  // Balances socket
  const balancesSocket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'balances',
    onOpen: () => {
      console.log('✅ BlazeProvider: Connected to balances server');
      // Re-subscribe to current user if we have one
      if (currentUserSubscription.current && balancesSocket) {
        balancesSocket.send(JSON.stringify({
          type: 'SUBSCRIBE',
          userIds: [currentUserSubscription.current],
          clientId: 'blaze-provider'
        }));
      }
    },
    onClose: () => {
      console.log('🔌 BlazeProvider: Disconnected from balances server');
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'BALANCE_UPDATE':
            // Extract base contractId (before :: if present)
            const baseContractId = data.contractId?.split('::')[0];
            if (baseContractId && data.userId && data.balance !== undefined) {
              setBalances(prev => ({
                ...prev,
                [`${data.userId}:${baseContractId}`]: {
                  // Core balance fields
                  balance: String(data.balance || 0),
                  totalSent: data.totalSent || '0',
                  totalReceived: data.totalReceived || '0',
                  formattedBalance: data.formattedBalance || 0,
                  timestamp: data.timestamp || Date.now(),
                  source: data.source || 'realtime',
                  
                  // Subnet balance fields
                  subnetBalance: data.subnetBalance,
                  formattedSubnetBalance: data.formattedSubnetBalance,
                  subnetContractId: data.subnetContractId,
                  
                  // NEW: Structured metadata (includes price data, market data, etc.)
                  metadata: data.metadata || {
                    // Fallback metadata if structured metadata not available
                    contractId: baseContractId,
                    name: data.name || 'Unknown Token',
                    symbol: data.symbol || 'TKN',
                    decimals: data.decimals || 6,
                    type: data.tokenType || 'SIP10',
                    identifier: data.identifier || '',
                    description: data.description,
                    image: data.image,
                    token_uri: data.token_uri,
                    total_supply: data.total_supply,
                    lastUpdated: data.lastUpdated,
                    tokenAContract: data.tokenAContract,
                    tokenBContract: data.tokenBContract,
                    lpRebatePercent: data.lpRebatePercent,
                    externalPoolId: data.externalPoolId,
                    engineContractId: data.engineContractId,
                    base: data.baseToken,
                    verified: false,
                    // Price data will be null if not available in legacy messages
                    price: null,
                    change1h: null,
                    change24h: null,
                    change7d: null,
                    marketCap: null
                  },
                  
                  // Legacy fields for backward compatibility (populated from metadata)
                  name: data.metadata?.name || data.name,
                  symbol: data.metadata?.symbol || data.symbol,
                  decimals: data.metadata?.decimals || data.decimals,
                  description: data.metadata?.description || data.description,
                  image: data.metadata?.image || data.image,
                  total_supply: data.metadata?.total_supply || data.total_supply,
                  type: data.metadata?.type || data.tokenType,
                  identifier: data.metadata?.identifier || data.identifier,
                  token_uri: data.metadata?.token_uri || data.token_uri,
                  lastUpdated: data.metadata?.lastUpdated || data.lastUpdated,
                  tokenAContract: data.metadata?.tokenAContract || data.tokenAContract,
                  tokenBContract: data.metadata?.tokenBContract || data.tokenBContract,
                  lpRebatePercent: data.metadata?.lpRebatePercent || data.lpRebatePercent,
                  externalPoolId: data.metadata?.externalPoolId || data.externalPoolId,
                  engineContractId: data.metadata?.engineContractId || data.engineContractId,
                  base: data.metadata?.base || data.baseToken
                }
              }));
              setLastUpdate(Date.now());
            }
            break;

          case 'BALANCE_BATCH':
            console.log('📊 BlazeProvider: Received BALANCE_BATCH:', data);
            if (data.balances && Array.isArray(data.balances)) {
              const newBalances: Record<string, BalanceData> = {};
              data.balances.forEach((balance: any) => {
                const baseContractId = balance.contractId?.split('::')[0];
                if (baseContractId && balance.userId && balance.balance !== undefined) {
                  newBalances[`${balance.userId}:${baseContractId}`] = {
                    // Core balance fields
                    balance: String(balance.balance || 0),
                    totalSent: balance.totalSent || '0',
                    totalReceived: balance.totalReceived || '0',
                    formattedBalance: balance.formattedBalance || 0,
                    timestamp: balance.timestamp || Date.now(),
                    source: balance.source || 'realtime',
                    
                    // Subnet balance fields
                    subnetBalance: balance.subnetBalance,
                    formattedSubnetBalance: balance.formattedSubnetBalance,
                    subnetContractId: balance.subnetContractId,
                    
                    // NEW: Structured metadata (includes price data, market data, etc.)
                    metadata: balance.metadata || {
                      // Fallback metadata if structured metadata not available
                      contractId: baseContractId,
                      name: balance.name || 'Unknown Token',
                      symbol: balance.symbol || 'TKN',
                      decimals: balance.decimals || 6,
                      type: balance.tokenType || 'SIP10',
                      identifier: balance.identifier || '',
                      description: balance.description,
                      image: balance.image,
                      token_uri: balance.token_uri,
                      total_supply: balance.total_supply,
                      lastUpdated: balance.lastUpdated,
                      tokenAContract: balance.tokenAContract,
                      tokenBContract: balance.tokenBContract,
                      lpRebatePercent: balance.lpRebatePercent,
                      externalPoolId: balance.externalPoolId,
                      engineContractId: balance.engineContractId,
                      base: balance.baseToken,
                      verified: false,
                      // Price data will be null if not available in legacy messages
                      price: null,
                      change1h: null,
                      change24h: null,
                      change7d: null,
                      marketCap: null
                    },
                    
                    // Legacy fields for backward compatibility (populated from metadata)
                    name: balance.metadata?.name || balance.name,
                    symbol: balance.metadata?.symbol || balance.symbol,
                    decimals: balance.metadata?.decimals || balance.decimals,
                    description: balance.metadata?.description || balance.description,
                    image: balance.metadata?.image || balance.image,
                    total_supply: balance.metadata?.total_supply || balance.total_supply,
                    type: balance.metadata?.type || balance.tokenType,
                    identifier: balance.metadata?.identifier || balance.identifier,
                    token_uri: balance.metadata?.token_uri || balance.token_uri,
                    lastUpdated: balance.metadata?.lastUpdated || balance.lastUpdated,
                    tokenAContract: balance.metadata?.tokenAContract || balance.tokenAContract,
                    tokenBContract: balance.metadata?.tokenBContract || balance.tokenBContract,
                    lpRebatePercent: balance.metadata?.lpRebatePercent || balance.lpRebatePercent,
                    externalPoolId: balance.metadata?.externalPoolId || balance.externalPoolId,
                    engineContractId: balance.metadata?.engineContractId || balance.engineContractId,
                    base: balance.metadata?.base || balance.baseToken
                  };
                }
              });
              console.log(`📊 BlazeProvider: Processed ${Object.keys(newBalances).length} balance entries`);
              setBalances(prev => ({ ...prev, ...newBalances }));
              setLastUpdate(Date.now());
            } else {
              console.warn('📊 BlazeProvider: BALANCE_BATCH received but no valid balances array');
            }
            break;

          case 'SERVER_INFO':
            console.log('BlazeProvider: Balances server info:', data);
            break;

          case 'ERROR':
            console.error('BlazeProvider: Balances server error:', data.message);
            break;
        }
      } catch (error) {
        console.error('BlazeProvider: Error parsing balances message:', error);
      }
    }
  });

  // Utility functions (memoized to prevent unnecessary re-renders)
  const getPrice = useCallback((contractId: string): number | undefined => {
    const result = prices[contractId]?.price;
    return result;
  }, [prices]);

  const getBalance = useCallback((userId: string, contractId: string): BalanceData | undefined => {
    // Defensive checks
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return undefined;
    }
    if (!contractId || typeof contractId !== 'string' || contractId.trim() === '') {
      return undefined;
    }
    
    return balances[`${userId.trim()}:${contractId.trim()}`];
  }, [balances]);

  const getMetadata = useCallback((contractId: string): TokenMetadata | undefined => {
    return metadata[contractId];
  }, [metadata]);

  // Helper function to get all balances for a specific user
  const getUserBalances = useCallback((userId?: string | null): Record<string, BalanceData> => {
    // Return empty object if userId is not provided or invalid
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return {};
    }

    const trimmedUserId = userId.trim();
    const userBalances: Record<string, BalanceData> = {};
    
    // Filter balances for the specific user
    Object.entries(balances).forEach(([key, balance]) => {
      if (key.startsWith(`${trimmedUserId}:`)) {
        // Extract contract ID from key (remove userId prefix)
        const contractId = key.substring(trimmedUserId.length + 1);
        userBalances[contractId] = balance;
      }
    });

    return userBalances;
  }, [balances]);

  // Internal function to manage balance subscriptions (memoized)
  const subscribeToUserBalances = useCallback((userId: string) => {
    // Defensive checks
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.warn('⚠️ BlazeProvider: Cannot subscribe - invalid userId provided:', userId);
      return;
    }

    const trimmedUserId = userId.trim();
    if (currentUserSubscription.current === trimmedUserId) return;

    // Unsubscribe from previous user if any
    if (currentUserSubscription.current && balancesSocket) {
      balancesSocket.send(JSON.stringify({
        type: 'UNSUBSCRIBE',
        userIds: [currentUserSubscription.current],
        clientId: 'blaze-provider'
      }));
    }

    // Subscribe to new user
    currentUserSubscription.current = trimmedUserId;
    if (balancesSocket && balancesSocket.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        type: 'SUBSCRIBE',
        userIds: [trimmedUserId],
        clientId: 'blaze-provider'
      };
      balancesSocket.send(JSON.stringify(subscribeMessage));
      console.log(`📊 BlazeProvider: Subscribed to balances for user: ${trimmedUserId}`, subscribeMessage);
    } else {
      console.warn(`⚠️ BlazeProvider: Cannot subscribe to balances - socket not ready. State: ${balancesSocket?.readyState}`);
    }
  }, [balancesSocket]);

  const unsubscribeFromUserBalances = useCallback(() => {
    if (currentUserSubscription.current && balancesSocket) {
      balancesSocket.send(JSON.stringify({
        type: 'UNSUBSCRIBE',
        userIds: [currentUserSubscription.current],
        clientId: 'blaze-provider'
      }));
      console.log(`📊 BlazeProvider: Unsubscribed from balances for user: ${currentUserSubscription.current}`);
      currentUserSubscription.current = null;
    }
  }, [balancesSocket]);

  const contextValue: BlazeContextType = useMemo(() => ({
    prices,
    balances,
    metadata,
    isConnected,
    lastUpdate,
    getPrice,
    getBalance,
    getMetadata,
    getUserBalances,
    _subscribeToUserBalances: subscribeToUserBalances,
    _unsubscribeFromUserBalances: unsubscribeFromUserBalances
  }), [prices, balances, metadata, isConnected, lastUpdate, getPrice, getBalance, getMetadata, getUserBalances, subscribeToUserBalances, unsubscribeFromUserBalances]);

  return (
    <BlazeContext.Provider value={contextValue}>
      {children}
    </BlazeContext.Provider>
  );
}

// Custom hook to use the Blaze context with configuration
export function useBlaze(config?: BlazeConfig): BlazeData {
  const context = useContext(BlazeContext);

  if (context === undefined) {
    throw new Error('useBlaze must be used within a BlazeProvider');
  }

  // Handle balance subscription based on config
  useEffect(() => {
    // Only subscribe if userId is a non-empty string
    if (config?.userId && typeof config.userId === 'string' && config.userId.trim() !== '') {
      context._subscribeToUserBalances(config.userId);
    } else {
      // Unsubscribe if userId is null, undefined, empty string, or invalid
      context._unsubscribeFromUserBalances();
    }

    // Cleanup on unmount or userId change
    return () => {
      if (config?.userId && typeof config.userId === 'string' && config.userId.trim() !== '') {
        // Don't unsubscribe on unmount - let other components continue using the subscription
        // Only unsubscribe when userId actually changes or is removed
      }
    };
  }, [config?.userId, context]); // Include context to ensure we have the latest functions

  return context;
}