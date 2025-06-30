'use client';

/**
 * BlazeProvider - Context provider for real-time price and balance data
 * Manages WebSocket connections and provides shared state across components
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo, useCallback } from 'react';
import usePartySocket from 'partysocket/react';
import { BlazeData, BlazeConfig, PriceData, BalanceData, TokenMetadata } from '../types';
import { getBalanceKey, isSubnetToken, getTokenFamily } from '../utils/token-utils';

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
            if (data.contractId && data.userId && data.balance !== undefined) {
              setBalances(prev => {
                // Use token utilities to determine the balance key
                const key = getBalanceKey(data.userId, data.contractId, data.metadata);
                const existingBalance = prev[key];
                const isSubnet = isSubnetToken(data.contractId, data.metadata);
                
                // Debug logging
                const tokenFamily = getTokenFamily(data.contractId, data.metadata);
                console.log(`🔄 BlazeProvider: Processing ${isSubnet ? 'subnet' : 'mainnet'} token:`, tokenFamily);
                
                // Merge logic: preserve existing data and update only relevant fields
                const mergedBalance = {
                  // Start with existing balance or create new one
                  ...existingBalance,
                  
                  // Update core fields only if this is a mainnet update OR no existing mainnet data
                  ...((!isSubnet || !existingBalance?.balance) && {
                    balance: String(data.balance || 0),
                    totalSent: data.totalSent || '0',
                    totalReceived: data.totalReceived || '0',
                    formattedBalance: data.formattedBalance || 0,
                    source: data.source || 'realtime'
                  }),
                  
                  // Always update timestamp
                  timestamp: data.timestamp || Date.now(),
                  
                  // Update subnet fields only if this is a subnet update
                  ...(isSubnet && {
                    subnetBalance: data.balance,
                    formattedSubnetBalance: data.formattedBalance,
                    subnetContractId: data.contractId,
                  }),
                  
                  // Merge metadata (prioritize new metadata but preserve existing if not provided)
                  metadata: {
                    // Start with existing metadata
                    ...existingBalance?.metadata,
                    // Merge in new metadata
                    ...(data.metadata || {
                      // Fallback metadata if structured metadata not available
                      contractId: tokenFamily.baseContractId,
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
                      base: data.baseToken || tokenFamily.baseContractId,
                      verified: false,
                      // Price data will be null if not available in legacy messages
                      price: null,
                      change1h: null,
                      change24h: null,
                      change7d: null,
                      marketCap: null
                    })
                  },
                  
                  // Legacy fields for backward compatibility (prioritize metadata then new data then existing)
                  name: data.metadata?.name || data.name || existingBalance?.name,
                  symbol: data.metadata?.symbol || data.symbol || existingBalance?.symbol,
                  decimals: data.metadata?.decimals || data.decimals || existingBalance?.decimals,
                  description: data.metadata?.description || data.description || existingBalance?.description,
                  image: data.metadata?.image || data.image || existingBalance?.image,
                  total_supply: data.metadata?.total_supply || data.total_supply || existingBalance?.total_supply,
                  type: data.metadata?.type || data.tokenType || existingBalance?.type,
                  identifier: data.metadata?.identifier || data.identifier || existingBalance?.identifier,
                  token_uri: data.metadata?.token_uri || data.token_uri || existingBalance?.token_uri,
                  lastUpdated: data.metadata?.lastUpdated || data.lastUpdated || existingBalance?.lastUpdated,
                  tokenAContract: data.metadata?.tokenAContract || data.tokenAContract || existingBalance?.tokenAContract,
                  tokenBContract: data.metadata?.tokenBContract || data.tokenBContract || existingBalance?.tokenBContract,
                  lpRebatePercent: data.metadata?.lpRebatePercent || data.lpRebatePercent || existingBalance?.lpRebatePercent,
                  externalPoolId: data.metadata?.externalPoolId || data.externalPoolId || existingBalance?.externalPoolId,
                  engineContractId: data.metadata?.engineContractId || data.engineContractId || existingBalance?.engineContractId,
                  base: data.metadata?.base || data.baseToken || existingBalance?.base
                };
                
                return {
                  ...prev,
                  [key]: mergedBalance
                };
              });
              setLastUpdate(Date.now());
            }
            break;

          case 'BALANCE_BATCH':
            console.log('📊 BlazeProvider: Received BALANCE_BATCH:', data);
            if (data.balances && Array.isArray(data.balances)) {
              setBalances(prev => {
                const updatedBalances = { ...prev };
                
                data.balances.forEach((balance: any) => {
                  if (balance.contractId && balance.userId && balance.balance !== undefined) {
                    // Use token utilities to determine the balance key
                    const key = getBalanceKey(balance.userId, balance.contractId, balance.metadata);
                    const existingBalance = updatedBalances[key];
                    const isSubnet = isSubnetToken(balance.contractId, balance.metadata);
                    const tokenFamily = getTokenFamily(balance.contractId, balance.metadata);
                    
                    // Apply same merge logic as BALANCE_UPDATE
                    const mergedBalance = {
                      // Start with existing balance or create new one
                      ...existingBalance,
                      
                      // Update core fields only if this is a mainnet update OR no existing mainnet data
                      ...((!isSubnet || !existingBalance?.balance) && {
                        balance: String(balance.balance || 0),
                        totalSent: balance.totalSent || '0',
                        totalReceived: balance.totalReceived || '0',
                        formattedBalance: balance.formattedBalance || 0,
                        source: balance.source || 'realtime'
                      }),
                      
                      // Always update timestamp
                      timestamp: balance.timestamp || Date.now(),
                      
                      // Update subnet fields only if this is a subnet update
                      ...(isSubnet && {
                        subnetBalance: balance.balance,
                        formattedSubnetBalance: balance.formattedBalance,
                        subnetContractId: balance.contractId,
                      }),
                      
                      // Merge metadata
                      metadata: {
                        ...existingBalance?.metadata,
                        ...(balance.metadata || {
                          contractId: tokenFamily.baseContractId,
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
                          base: balance.baseToken || tokenFamily.baseContractId,
                          verified: false,
                          price: null,
                          change1h: null,
                          change24h: null,
                          change7d: null,
                          marketCap: null
                        })
                      },
                      
                      // Legacy fields (prioritize metadata then new data then existing)
                      name: balance.metadata?.name || balance.name || existingBalance?.name,
                      symbol: balance.metadata?.symbol || balance.symbol || existingBalance?.symbol,
                      decimals: balance.metadata?.decimals || balance.decimals || existingBalance?.decimals,
                      description: balance.metadata?.description || balance.description || existingBalance?.description,
                      image: balance.metadata?.image || balance.image || existingBalance?.image,
                      total_supply: balance.metadata?.total_supply || balance.total_supply || existingBalance?.total_supply,
                      type: balance.metadata?.type || balance.tokenType || existingBalance?.type,
                      identifier: balance.metadata?.identifier || balance.identifier || existingBalance?.identifier,
                      token_uri: balance.metadata?.token_uri || balance.token_uri || existingBalance?.token_uri,
                      lastUpdated: balance.metadata?.lastUpdated || balance.lastUpdated || existingBalance?.lastUpdated,
                      tokenAContract: balance.metadata?.tokenAContract || balance.tokenAContract || existingBalance?.tokenAContract,
                      tokenBContract: balance.metadata?.tokenBContract || balance.tokenBContract || existingBalance?.tokenBContract,
                      lpRebatePercent: balance.metadata?.lpRebatePercent || balance.lpRebatePercent || existingBalance?.lpRebatePercent,
                      externalPoolId: balance.metadata?.externalPoolId || balance.externalPoolId || existingBalance?.externalPoolId,
                      engineContractId: balance.metadata?.engineContractId || balance.engineContractId || existingBalance?.engineContractId,
                      base: balance.metadata?.base || balance.baseToken || existingBalance?.base
                    };
                    
                    updatedBalances[key] = mergedBalance;
                  }
                });
                
                console.log(`📊 BlazeProvider: Processed ${data.balances.length} balance entries with client-side merging`);
                return updatedBalances;
              });
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
    
    // Use token utilities to find the correct balance key
    // This ensures we get the merged balance for both mainnet and subnet tokens
    const key = getBalanceKey(userId.trim(), contractId.trim());
    return balances[key];
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