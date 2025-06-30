'use client';

/**
 * BlazeProvider - Context provider for real-time price and balance data
 * Manages WebSocket connections and provides shared state across components
 */

import { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo, useCallback } from 'react';
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
                // Use token utilities to determine the balance key for merging
                const key = getBalanceKey(data.userId, data.contractId, data.metadata);
                const existingBalance = prev[key];
                const isSubnet = isSubnetToken(data.contractId, data.metadata);
                
                // Create merged balance data
                const updatedBalance: BalanceData = {
                  // Core fields - only update if this is NOT a subnet token (i.e., mainnet)
                  balance: isSubnet ? (existingBalance?.balance || '0') : String(data.balance || 0),
                  totalSent: isSubnet ? (existingBalance?.totalSent || '0') : (data.totalSent || '0'),
                  totalReceived: isSubnet ? (existingBalance?.totalReceived || '0') : (data.totalReceived || '0'),
                  formattedBalance: isSubnet ? (existingBalance?.formattedBalance || 0) : (data.formattedBalance || 0),
                  timestamp: data.timestamp || Date.now(),
                  source: data.source || 'realtime',
                  
                  // Subnet fields - only update if this is a subnet token
                  ...(isSubnet ? {
                    subnetBalance: data.balance,
                    formattedSubnetBalance: data.formattedBalance,
                    subnetContractId: data.contractId,
                  } : {
                    // Preserve existing subnet fields if this is a mainnet update
                    subnetBalance: existingBalance?.subnetBalance,
                    formattedSubnetBalance: existingBalance?.formattedSubnetBalance,
                    subnetContractId: existingBalance?.subnetContractId,
                  }),
                  
                  // Metadata - prioritize new data, fallback to existing
                  metadata: {
                    ...existingBalance?.metadata,
                    ...data.metadata,
                  },
                  
                  // Legacy fields for backward compatibility
                  name: data.name,
                  symbol: data.symbol,
                  decimals: data.decimals || 6,
                  description: data.description,
                  image: data.image,
                  total_supply: data.total_supply,
                  type: data.tokenType,
                  identifier: data.identifier,
                  token_uri: data.token_uri,
                  lastUpdated: data.lastUpdated,
                  tokenAContract: data.tokenAContract,
                  tokenBContract: data.tokenBContract,
                  lpRebatePercent: data.lpRebatePercent,
                  externalPoolId: data.externalPoolId,
                  engineContractId: data.engineContractId,
                  base: data.baseToken
                };
                
                return {
                  ...prev,
                  [key]: updatedBalance
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
                    // Use token utilities to determine the balance key for merging
                    const key = getBalanceKey(balance.userId, balance.contractId, balance.metadata);
                    const existingBalance = updatedBalances[key];
                    const isSubnet = isSubnetToken(balance.contractId, balance.metadata);
                    
                    // Create merged balance data
                    const mergedBalance: BalanceData = {
                      // Core fields - only update if this is NOT a subnet token (i.e., mainnet)
                      balance: isSubnet ? (existingBalance?.balance || '0') : String(balance.balance || 0),
                      totalSent: isSubnet ? (existingBalance?.totalSent || '0') : (balance.totalSent || '0'),
                      totalReceived: isSubnet ? (existingBalance?.totalReceived || '0') : (balance.totalReceived || '0'),
                      formattedBalance: isSubnet ? (existingBalance?.formattedBalance || 0) : (balance.formattedBalance || 0),
                      timestamp: balance.timestamp || Date.now(),
                      source: balance.source || 'realtime',
                      
                      // Subnet fields - only update if this is a subnet token
                      ...(isSubnet ? {
                        subnetBalance: balance.balance,
                        formattedSubnetBalance: balance.formattedBalance,
                        subnetContractId: balance.contractId,
                      } : {
                        // Preserve existing subnet fields if this is a mainnet update
                        subnetBalance: existingBalance?.subnetBalance,
                        formattedSubnetBalance: existingBalance?.formattedSubnetBalance,
                        subnetContractId: existingBalance?.subnetContractId,
                      }),
                      
                      // Metadata - prioritize new data, fallback to existing
                      metadata: {
                        ...existingBalance?.metadata,
                        ...balance.metadata,
                      },
                      
                      // Legacy fields for backward compatibility
                      name: balance.name,
                      symbol: balance.symbol,
                      decimals: balance.decimals || 6,
                      description: balance.description,
                      image: balance.image,
                      total_supply: balance.total_supply,
                      type: balance.tokenType,
                      identifier: balance.identifier,
                      token_uri: balance.token_uri,
                      lastUpdated: balance.lastUpdated,
                      tokenAContract: balance.tokenAContract,
                      tokenBContract: balance.tokenBContract,
                      lpRebatePercent: balance.lpRebatePercent,
                      externalPoolId: balance.externalPoolId,
                      engineContractId: balance.engineContractId,
                      base: balance.baseToken
                    };
                    
                    updatedBalances[key] = mergedBalance;
                  }
                });
                
                console.log(`📊 BlazeProvider: Processed ${data.balances.length} balance entries with subnet merging`);
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