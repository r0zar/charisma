'use client';
/**
 * BlazeProvider - Context provider for real-time price and balance data
 * Simplified version without excessive memoization
 */
import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import usePartySocket from 'partysocket/react';
import { BlazeData, BlazeConfig, PriceData, BalanceData, TokenMetadata } from '../types';
import { getBalanceKey, isSubnetToken, getTokenFamily } from '../utils/token-utils';

interface BlazeContextType extends BlazeData {
  _subscribeToUserBalances: (userIds: string[]) => void;
  _unsubscribeFromUserBalances: (userIds?: string[]) => void;
  refreshBalances: (userIds?: string[]) => void;
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
  const subscribedUsers = useRef<Set<string>>(new Set());
  const socketRefs = useRef<{ prices?: any; balances?: any }>({});

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
      pricesSocket.send(JSON.stringify({
        type: 'SUBSCRIBE',
        contractIds: [], // Empty = subscribe to all
        clientId: 'blaze-provider'
      }));
    },
    onClose: () => {
      setIsConnected(false);
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        handlePriceMessage(data);
      } catch (error) {
        // Silently ignore parse errors
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
      if (subscribedUsers.current.size > 0) {
        balancesSocket.send(JSON.stringify({
          type: 'SUBSCRIBE',
          userIds: Array.from(subscribedUsers.current),
          clientId: 'blaze-provider'
        }));
      }
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        handleBalanceMessage(data);
      } catch (error) {
        // Silently ignore parse errors
      }
    }
  });

  // Store socket refs for use in functions
  socketRefs.current = { prices: pricesSocket, balances: balancesSocket };

  // Message handlers
  function handlePriceMessage(data: any) {
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

      case 'ERROR':
        console.error('BlazeProvider: Prices server error:', data.message);
        break;
    }
  }

  function handleBalanceMessage(data: any) {
    switch (data.type) {
      case 'BALANCE_UPDATE':
        if (data.contractId && data.userId && data.balance !== undefined) {
          updateBalance(data);
        }
        break;

      case 'BALANCE_BATCH':
        if (data.balances && Array.isArray(data.balances)) {
          data.balances.forEach((balance: any) => {
            if (balance.contractId && balance.userId && balance.balance !== undefined) {
              updateBalance(balance);
            }
          });
        }
        break;

      case 'ERROR':
        console.error('BlazeProvider: Balances server error:', data.message);
        break;
    }
  }

  function updateBalance(data: any) {
    setBalances(prev => {
      const key = getBalanceKey(data.userId, data.contractId, data.metadata);
      const existingBalance = prev[key];
      const isSubnet = isSubnetToken(data.contractId, data.metadata);

      const updatedBalance: BalanceData = {
        // Core fields - only update if this is NOT a subnet token
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
          subnetBalance: existingBalance?.subnetBalance,
          formattedSubnetBalance: existingBalance?.formattedSubnetBalance,
          subnetContractId: existingBalance?.subnetContractId,
        }),

        // Metadata
        metadata: {
          ...existingBalance?.metadata,
          ...data.metadata,
        },

        // Legacy fields
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

      return { ...prev, [key]: updatedBalance };
    });
    setLastUpdate(Date.now());
  }

  // Simple utility functions (no memoization needed)
  function getPrice(contractId: string): number | undefined {
    return prices[contractId]?.price;
  }

  function getBalance(userId: string, contractId: string): BalanceData | undefined {
    if (!userId || !contractId || typeof userId !== 'string' || typeof contractId !== 'string') {
      return undefined;
    }
    const key = getBalanceKey(userId.trim(), contractId.trim());
    return balances[key];
  }

  function getMetadata(contractId: string): TokenMetadata | undefined {
    return metadata[contractId];
  }

  function getUserBalances(userId?: string | null): Record<string, BalanceData> {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return {};
    }

    const trimmedUserId = userId.trim();
    const userBalances: Record<string, BalanceData> = {};

    Object.entries(balances).forEach(([key, balance]) => {
      if (key.startsWith(`${trimmedUserId}:`)) {
        const contractId = key.substring(trimmedUserId.length + 1);
        userBalances[contractId] = balance;
      }
    });

    return userBalances;
  }

  // Subscription management
  function subscribeToUserBalances(userIds: string[]) {
    const validUserIds = userIds
      .filter(id => id && typeof id === 'string' && id.trim() !== '')
      .map(id => id.trim());

    if (validUserIds.length === 0) return;

    const newUsers: string[] = [];
    validUserIds.forEach(userId => {
      if (!subscribedUsers.current.has(userId)) {
        subscribedUsers.current.add(userId);
        newUsers.push(userId);
      }
    });

    if (newUsers.length > 0 && socketRefs.current.balances?.readyState === WebSocket.OPEN) {
      socketRefs.current.balances.send(JSON.stringify({
        type: 'SUBSCRIBE',
        userIds: newUsers,
        clientId: 'blaze-provider'
      }));
    }
  }

  function unsubscribeFromUserBalances(userIds?: string[]) {
    if (!userIds) {
      // Unsubscribe from all
      if (subscribedUsers.current.size > 0 && socketRefs.current.balances) {
        socketRefs.current.balances.send(JSON.stringify({
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

      if (validUserIds.length > 0 && socketRefs.current.balances) {
        validUserIds.forEach(userId => subscribedUsers.current.delete(userId));
        socketRefs.current.balances.send(JSON.stringify({
          type: 'UNSUBSCRIBE',
          userIds: validUserIds,
          clientId: 'blaze-provider'
        }));
      }
    }
  }

  // Force refresh balances for specific users
  function refreshBalances(userIds?: string[]) {
    const usersToRefresh = userIds || Array.from(subscribedUsers.current);
    const validUserIds = usersToRefresh
      .filter(id => id && typeof id === 'string' && id.trim() !== '')
      .map(id => id.trim());

    if (validUserIds.length > 0 && socketRefs.current.balances?.readyState === WebSocket.OPEN) {
      // Send a refresh request to the server
      socketRefs.current.balances.send(JSON.stringify({
        type: 'REFRESH',
        userIds: validUserIds,
        clientId: 'blaze-provider'
      }));
    }
  }

  // Build context value
  const contextValue: BlazeContextType = {
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
    _unsubscribeFromUserBalances: unsubscribeFromUserBalances,
    refreshBalances
  };

  return (
    <BlazeContext.Provider value={contextValue}>
      {children}
    </BlazeContext.Provider>
  );
}

// Custom hook
export function useBlaze(config?: BlazeConfig & { userIds?: string[] }): BlazeData {
  const context = useContext(BlazeContext);
  if (!context) {
    throw new Error('useBlaze must be used within a BlazeProvider');
  }

  // Handle balance subscription
  useEffect(() => {
    const userIds = config?.userIds || (config?.userId ? [config.userId] : []);
    const validUserIds = userIds.filter(id => id && typeof id === 'string' && id.trim() !== '');

    if (validUserIds.length > 0) {
      context._subscribeToUserBalances(validUserIds);

      // Cleanup
      return () => {
        context._unsubscribeFromUserBalances(validUserIds);
      };
    }
  }, [config?.userId, config?.userIds?.join(',')]); // Join array to create stable dependency

  // Return public API only
  const { _subscribeToUserBalances, _unsubscribeFromUserBalances, ...publicApi } = context;
  return publicApi;
}