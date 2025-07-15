'use client';
/**
 * BlazeProvider - Context provider for real-time price and balance data
 * Simplified version without excessive memoization
 */
import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import usePartySocket from 'partysocket/react';
import { BlazeData, BlazeConfig, PriceData, BalanceData, TokenMetadata } from '../types';
import { getBalanceKey, isSubnetToken, getTokenFamily } from '../utils/token-utils';
import { getTokenMetadataCached, listTokens, fetchMetadata, TokenCacheData } from '@repo/tokens';

interface BlazeContextType extends BlazeData {
  _subscribeToUserBalances: (userIds: string[]) => void;
  _unsubscribeFromUserBalances: (userIds?: string[]) => void;
  refreshBalances: (userIds?: string[]) => void;
  isInitialized: boolean;
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
  const [isInitialized, setIsInitialized] = useState(false);

  // Track current balance subscriptions
  const subscribedUsers = useRef<Set<string>>(new Set());
  const socketRefs = useRef<{ prices?: any; balances?: any }>({});

  // Initialize metadata on startup
  useEffect(() => {
    async function initializeMetadata() {
      try {
        console.log('BlazeProvider: Initializing token metadata...');
        const tokens = await fetchMetadata();

        if (tokens && tokens.length > 0) {
          const initialMetadata: Record<string, TokenMetadata> = {};

          tokens.forEach((token: TokenCacheData) => {
            if (token.contractId) {
              initialMetadata[token.contractId] = {
                contractId: token.contractId,
                name: token.name || token.symbol,
                symbol: token.symbol,
                decimals: token.decimals || 6,
                description: token.description || undefined,
                image: token.image || undefined,
                type: token.type || 'token',
                identifier: token.identifier || token.contractId,
                token_uri: token.token_uri || undefined,
                lastUpdated: token.lastUpdated || Date.now(),
                total_supply: token.total_supply || undefined,
                tokenAContract: token.tokenAContract || undefined,
                tokenBContract: token.tokenBContract || undefined,
                lpRebatePercent: token.lpRebatePercent || undefined,
                externalPoolId: token.externalPoolId || undefined,
                engineContractId: token.engineContractId || undefined,
                base: token.base || undefined
              };
            }
          });

          setMetadata(initialMetadata);
          console.log(`BlazeProvider: Initialized metadata for ${tokens.length} tokens`);
          
          // Trigger update notification to client
          setLastUpdate(Date.now());
          console.log('BlazeProvider: Metadata update notification sent');
        }
      } catch (error) {
        console.warn('BlazeProvider: Failed to initialize metadata:', error);
      } finally {
        setIsInitialized(true);
      }
    }

    initializeMetadata();
  }, []);

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
      console.log('BlazeProvider: Prices socket connected to', partyHost);
      setIsConnected(true);
      const subscribeMessage = {
        type: 'SUBSCRIBE',
        contractIds: [], // Empty = subscribe to all
        clientId: 'blaze-provider'
      };
      console.log('BlazeProvider: Sending prices subscription:', subscribeMessage);
      pricesSocket.send(JSON.stringify(subscribeMessage));
    },
    onClose: () => {
      console.log('BlazeProvider: Prices socket disconnected');
      setIsConnected(false);
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('BlazeProvider: Prices message received:', data.type, data);
        handlePriceMessage(data);
      } catch (error) {
        console.error('BlazeProvider: Failed to parse prices message:', error, event.data);
      }
    }
  });

  // Balances socket
  const balancesSocket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'balances',
    onOpen: () => {
      console.log('BlazeProvider: Balances socket connected to', partyHost);
      // Re-subscribe to all users if we have any
      if (subscribedUsers.current.size > 0) {
        const subscribeMessage = {
          type: 'SUBSCRIBE',
          userIds: Array.from(subscribedUsers.current),
          clientId: 'blaze-provider'
        };
        console.log('BlazeProvider: Re-subscribing to users on reconnect:', subscribeMessage);
        balancesSocket.send(JSON.stringify(subscribeMessage));
      } else {
        console.log('BlazeProvider: No users to re-subscribe to');
      }
    },
    onClose: () => {
      console.log('BlazeProvider: Balances socket disconnected');
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('BlazeProvider: Balances message received:', data.type, data);
        handleBalanceMessage(data);
      } catch (error) {
        console.error('BlazeProvider: Failed to parse balances message:', error, event.data);
      }
    }
  });

  // Store socket refs for use in functions
  socketRefs.current = { prices: pricesSocket, balances: balancesSocket };

  // Message handlers
  function handlePriceMessage(data: any) {
    switch (data.type) {
      case 'PRICE_UPDATE':
        console.log('BlazeProvider: Processing price update for', data.contractId, 'price:', data.price);
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
        console.log('BlazeProvider: Processing price batch with', data.prices?.length, 'prices');
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
        console.log('BlazeProvider: Updated prices for', Object.keys(newPrices).length, 'contracts');
        break;

      case 'METADATA_UPDATE':
        if (data.contractId && data.metadata) {
          console.log('BlazeProvider: Processing metadata update for', data.contractId);
          setMetadata(prev => ({
            ...prev,
            [data.contractId]: {
              contractId: data.contractId,
              ...data.metadata
            }
          }));
          setLastUpdate(Date.now());
        } else {
          console.warn('BlazeProvider: Invalid metadata update message:', data);
        }
        break;

      case 'METADATA_BATCH':
        if (data.metadata && Array.isArray(data.metadata)) {
          console.log('BlazeProvider: Processing metadata batch with', data.metadata.length, 'tokens');
          const newMetadata: Record<string, TokenMetadata> = {};
          data.metadata.forEach((meta: any) => {
            if (meta.contractId) {
              newMetadata[meta.contractId] = {
                contractId: meta.contractId,
                ...meta
              };
            }
          });
          setMetadata(prev => ({ ...prev, ...newMetadata }));
          setLastUpdate(Date.now());
          console.log('BlazeProvider: Updated metadata for', Object.keys(newMetadata).length, 'contracts');
        } else {
          console.warn('BlazeProvider: Invalid metadata batch message:', data);
        }
        break;

      case 'ERROR':
        console.error('BlazeProvider: Prices server error:', data.message);
        break;
        
      default:
        console.log('BlazeProvider: Unknown price message type:', data.type);
    }
  }

  function handleBalanceMessage(data: any) {
    switch (data.type) {
      case 'BALANCE_UPDATE':
        if (data.contractId && data.userId && data.balance !== undefined) {
          console.log('BlazeProvider: Processing balance update for user', data.userId, 'contract', data.contractId);
          updateBalance(data);
        } else {
          console.warn('BlazeProvider: Invalid balance update message:', data);
        }
        break;

      case 'BALANCE_BATCH':
        if (data.balances && Array.isArray(data.balances)) {
          console.log('BlazeProvider: Processing balance batch with', data.balances.length, 'balances');
          let validUpdates = 0;
          data.balances.forEach((balance: any) => {
            if (balance.contractId && balance.userId && balance.balance !== undefined) {
              updateBalance(balance);
              validUpdates++;
            } else {
              console.warn('BlazeProvider: Invalid balance in batch:', balance);
            }
          });
          console.log('BlazeProvider: Processed', validUpdates, 'valid balance updates from batch');
        } else {
          console.warn('BlazeProvider: Invalid balance batch message:', data);
        }
        break;

      case 'ERROR':
        console.error('BlazeProvider: Balances server error:', data.message);
        break;
        
      default:
        console.log('BlazeProvider: Unknown balance message type:', data.type);
    }
  }

  function updateBalance(data: any) {
    console.log('BlazeProvider: updateBalance called with data:', data);
    setBalances(prev => {
      const key = getBalanceKey(data.userId, data.contractId, data.metadata);
      const existingBalance = prev[key];
      const isSubnet = isSubnetToken(data.contractId, data.metadata);
      console.log('BlazeProvider: Balance key:', key, 'isSubnet:', isSubnet);

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

    // Extract and update metadata from balance data
    if (data.contractId) {
      console.log('BlazeProvider: Extracting metadata from balance data for', data.contractId);
      console.log('BlazeProvider: Balance data fields:', { 
        name: data.name, 
        symbol: data.symbol, 
        decimals: data.decimals,
        image: data.image,
        hasMetadata: !!data.metadata 
      });
      
      setMetadata(prev => {
        const existing = prev[data.contractId];
        const updated = {
          contractId: data.contractId,
          name: data.name || existing?.name,
          symbol: data.symbol || existing?.symbol,
          decimals: data.decimals || existing?.decimals || 6,
          description: data.description || existing?.description,
          image: data.image || existing?.image,
          type: data.tokenType || existing?.type,
          identifier: data.identifier || existing?.identifier,
          token_uri: data.token_uri || existing?.token_uri,
          lastUpdated: data.lastUpdated || existing?.lastUpdated,
          total_supply: data.total_supply || existing?.total_supply,
          tokenAContract: data.tokenAContract || existing?.tokenAContract,
          tokenBContract: data.tokenBContract || existing?.tokenBContract,
          lpRebatePercent: data.lpRebatePercent || existing?.lpRebatePercent,
          externalPoolId: data.externalPoolId || existing?.externalPoolId,
          engineContractId: data.engineContractId || existing?.engineContractId,
          base: data.baseToken || existing?.base,
          ...(data.metadata || {})
        };
        
        console.log('BlazeProvider: Updated metadata for', data.contractId, ':', updated);
        return { ...prev, [data.contractId]: updated };
      });
    }

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

    console.log('BlazeProvider: subscribeToUserBalances called with userIds:', userIds);
    console.log('BlazeProvider: Valid userIds after filtering:', validUserIds);

    if (validUserIds.length === 0) {
      console.log('BlazeProvider: No valid userIds to subscribe to');
      return;
    }

    const newUsers: string[] = [];
    validUserIds.forEach(userId => {
      if (!subscribedUsers.current.has(userId)) {
        subscribedUsers.current.add(userId);
        newUsers.push(userId);
      }
    });

    console.log('BlazeProvider: New users to subscribe:', newUsers);
    console.log('BlazeProvider: Total subscribed users:', Array.from(subscribedUsers.current));

    if (newUsers.length > 0 && socketRefs.current.balances?.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        type: 'SUBSCRIBE',
        userIds: newUsers,
        clientId: 'blaze-provider'
      };
      console.log('BlazeProvider: Sending balance subscription:', subscribeMessage);
      socketRefs.current.balances.send(JSON.stringify(subscribeMessage));
    } else if (newUsers.length > 0) {
      console.log('BlazeProvider: Cannot subscribe - socket not ready. ReadyState:', socketRefs.current.balances?.readyState);
    } else {
      console.log('BlazeProvider: No new users to subscribe to');
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
    isInitialized,
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

    console.log('useBlaze: Effect triggered with config:', config);
    console.log('useBlaze: Extracted userIds:', userIds);
    console.log('useBlaze: Valid userIds:', validUserIds);

    if (validUserIds.length > 0) {
      console.log('useBlaze: Subscribing to user balances for:', validUserIds);
      context._subscribeToUserBalances(validUserIds);

      // Cleanup
      return () => {
        console.log('useBlaze: Unsubscribing from user balances for:', validUserIds);
        context._unsubscribeFromUserBalances(validUserIds);
      };
    } else {
      console.log('useBlaze: No valid userIds to subscribe to');
    }
  }, [config?.userId, config?.userIds?.join(',')]); // Join array to create stable dependency

  // Return public API only
  const { _subscribeToUserBalances, _unsubscribeFromUserBalances, ...publicApi } = context;
  return publicApi;
}