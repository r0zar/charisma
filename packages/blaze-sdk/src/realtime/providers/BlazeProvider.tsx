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
                source: data.source
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
                source: price.source
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
                  balance: data.balance,
                  totalSent: data.totalSent || '0',
                  totalReceived: data.totalReceived || '0',
                  timestamp: data.timestamp || Date.now(),
                  source: data.source || 'realtime'
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
                    balance: balance.balance,
                    totalSent: balance.totalSent || '0',
                    totalReceived: balance.totalReceived || '0',
                    timestamp: balance.timestamp || Date.now(),
                    source: balance.source || 'realtime'
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
    return prices[contractId]?.price;
  }, [prices]);

  const getBalance = useCallback((userId: string, contractId: string): BalanceData | undefined => {
    return balances[`${userId}:${contractId}`];
  }, [balances]);

  const getMetadata = useCallback((contractId: string): TokenMetadata | undefined => {
    return metadata[contractId];
  }, [metadata]);

  // Internal function to manage balance subscriptions (memoized)
  const subscribeToUserBalances = useCallback((userId: string) => {
    if (currentUserSubscription.current === userId) return;
    
    // Unsubscribe from previous user if any
    if (currentUserSubscription.current && balancesSocket) {
      balancesSocket.send(JSON.stringify({
        type: 'UNSUBSCRIBE',
        userIds: [currentUserSubscription.current],
        clientId: 'blaze-provider'
      }));
    }

    // Subscribe to new user
    currentUserSubscription.current = userId;
    if (balancesSocket && balancesSocket.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        type: 'SUBSCRIBE',
        userIds: [userId],
        clientId: 'blaze-provider'
      };
      balancesSocket.send(JSON.stringify(subscribeMessage));
      console.log(`📊 BlazeProvider: Subscribed to balances for user: ${userId}`, subscribeMessage);
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
    _subscribeToUserBalances: subscribeToUserBalances,
    _unsubscribeFromUserBalances: unsubscribeFromUserBalances
  }), [prices, balances, metadata, isConnected, lastUpdate, getPrice, getBalance, getMetadata, subscribeToUserBalances, unsubscribeFromUserBalances]);

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
    if (config?.userId) {
      context._subscribeToUserBalances(config.userId);
    } else {
      context._unsubscribeFromUserBalances();
    }

    // Cleanup on unmount or userId change
    return () => {
      if (config?.userId) {
        // Don't unsubscribe on unmount - let other components continue using the subscription
        // Only unsubscribe when userId actually changes or is removed
      }
    };
  }, [config?.userId]); // Remove context from dependencies to prevent re-subscription loops

  return context;
}