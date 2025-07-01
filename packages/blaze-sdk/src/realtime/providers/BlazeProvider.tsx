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
  _subscribeToUserBalances: (userIds: string[]) => void;
  _unsubscribeFromUserBalances: (userIds?: string[]) => void;
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

  // Track current balance subscriptions - support multiple users
  const subscribedUsers = useRef<Set<string>>(new Set());

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
            break;

          case 'ERROR':
            console.error('BlazeProvider: Prices server error:', data.message);
            break;
        }
      } catch (error) {
      }
    }
  });

  // Balances socket
  const balancesSocket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'balances',
    onOpen: () => {
      // Re-subscribe to all users if we have any
      if (subscribedUsers.current.size > 0 && balancesSocket) {
        balancesSocket.send(JSON.stringify({
          type: 'SUBSCRIBE',
          userIds: Array.from(subscribedUsers.current),
          clientId: 'blaze-provider'
        }));
      }
    },
    onClose: () => {
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
                
                return updatedBalances;
              });
              setLastUpdate(Date.now());
            } else {
            }
            break;

          case 'SERVER_INFO':
            break;

          case 'ERROR':
            console.error('BlazeProvider: Balances server error:', data.message);
            break;
        }
      } catch (error) {
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
  const subscribeToUserBalances = useCallback((userIds: string[]) => {
    const validUserIds = userIds
      .filter(id => id && typeof id === 'string' && id.trim() !== '')
      .map(id => id.trim());
    
    if (validUserIds.length === 0) return;

    // Add new users to subscription set
    const newUsers: string[] = [];
    validUserIds.forEach(userId => {
      if (!subscribedUsers.current.has(userId)) {
        subscribedUsers.current.add(userId);
        newUsers.push(userId);
      }
    });

    // Only send subscription for new users
    if (newUsers.length > 0 && balancesSocket && balancesSocket.readyState === WebSocket.OPEN) {
      balancesSocket.send(JSON.stringify({
        type: 'SUBSCRIBE',
        userIds: newUsers,
        clientId: 'blaze-provider'
      }));
    }
  }, [balancesSocket]);

  const unsubscribeFromUserBalances = useCallback((userIds?: string[]) => {
    if (!userIds) {
      // Unsubscribe from all users
      if (subscribedUsers.current.size > 0 && balancesSocket) {
        balancesSocket.send(JSON.stringify({
          type: 'UNSUBSCRIBE',
          userIds: Array.from(subscribedUsers.current),
          clientId: 'blaze-provider'
        }));
        subscribedUsers.current.clear();
      }
    } else {
      // Unsubscribe from specific users
      const validUserIds = userIds
        .filter(id => id && typeof id === 'string' && id.trim() !== '')
        .map(id => id.trim())
        .filter(id => subscribedUsers.current.has(id));
      
      if (validUserIds.length > 0 && balancesSocket) {
        validUserIds.forEach(userId => subscribedUsers.current.delete(userId));
        balancesSocket.send(JSON.stringify({
          type: 'UNSUBSCRIBE',
          userIds: validUserIds,
          clientId: 'blaze-provider'
        }));
      }
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
export function useBlaze(config?: BlazeConfig & { userIds?: string[] }): BlazeData {
  const context = useContext(BlazeContext);

  if (context === undefined) {
    throw new Error('useBlaze must be used within a BlazeProvider');
  }

  // Handle balance subscription based on config
  useEffect(() => {
    const userIds = config?.userIds || (config?.userId ? [config.userId] : []);
    const validUserIds = userIds.filter(id => id && typeof id === 'string' && id.trim() !== '');
    
    if (validUserIds.length > 0) {
      context._subscribeToUserBalances(validUserIds);
    }

    // Cleanup on unmount - unsubscribe from these specific users
    return () => {
      if (validUserIds.length > 0) {
        context._unsubscribeFromUserBalances(validUserIds);
      }
    };
  }, [config?.userId, config?.userIds, context]);

  return context;
}