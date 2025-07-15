'use client';
/**
 * BlazeProvider - Context provider for real-time price and balance data
 * Simplified version without excessive memoization
 */
import { createContext, useContext, useState, useEffect, ReactNode, useRef, useReducer, useTransition, useMemo, useCallback } from 'react';
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

// Reducer action types for optimized state updates
type BlazeAction = 
  | { type: 'SET_PRICES'; payload: Record<string, PriceData> }
  | { type: 'UPDATE_PRICE'; payload: PriceData }
  | { type: 'BATCH_PRICE_UPDATES'; payload: PriceData[] }
  | { type: 'SET_BALANCES'; payload: Record<string, BalanceData> }
  | { type: 'UPDATE_BALANCE'; payload: { key: string; balance: BalanceData } }
  | { type: 'BATCH_BALANCE_UPDATES'; payload: Array<{ key: string; balance: BalanceData }> }
  | { type: 'SET_METADATA'; payload: Record<string, TokenMetadata> }
  | { type: 'UPDATE_METADATA'; payload: { contractId: string; metadata: TokenMetadata } }
  | { type: 'SET_CONNECTION_STATUS'; payload: boolean }
  | { type: 'SET_LAST_UPDATE'; payload: number };

// State interface for the reducer
interface BlazeState {
  prices: Record<string, PriceData>;
  balances: Record<string, BalanceData>;
  metadata: Record<string, TokenMetadata>;
  isConnected: boolean;
  lastUpdate: number;
}

// Initial state
const initialState: BlazeState = {
  prices: {},
  balances: {},
  metadata: {},
  isConnected: false,
  lastUpdate: Date.now()
};

// Optimized reducer with change detection
function blazeReducer(state: BlazeState, action: BlazeAction): BlazeState {
  switch (action.type) {
    case 'SET_PRICES':
      return { ...state, prices: action.payload };
    
    case 'UPDATE_PRICE':
      const existingPrice = state.prices[action.payload.contractId];
      if (existingPrice?.price === action.payload.price && 
          existingPrice?.timestamp === action.payload.timestamp) {
        return state; // No change, return existing state
      }
      return { 
        ...state, 
        prices: { ...state.prices, [action.payload.contractId]: action.payload }
      };
    
    case 'BATCH_PRICE_UPDATES':
      const newPrices = { ...state.prices };
      let priceChanges = false;
      action.payload.forEach(price => {
        const existing = newPrices[price.contractId];
        if (!existing || existing.price !== price.price || existing.timestamp !== price.timestamp) {
          newPrices[price.contractId] = price;
          priceChanges = true;
        }
      });
      return priceChanges ? { ...state, prices: newPrices } : state;
    
    case 'SET_BALANCES':
      return { ...state, balances: action.payload };
    
    case 'UPDATE_BALANCE':
      const existingBalance = state.balances[action.payload.key];
      if (existingBalance?.balance === action.payload.balance.balance && 
          existingBalance?.formattedBalance === action.payload.balance.formattedBalance &&
          existingBalance?.timestamp === action.payload.balance.timestamp) {
        return state; // No change, return existing state
      }
      return { 
        ...state, 
        balances: { ...state.balances, [action.payload.key]: action.payload.balance }
      };
    
    case 'BATCH_BALANCE_UPDATES':
      const newBalances = { ...state.balances };
      let balanceChanges = false;
      action.payload.forEach(({ key, balance }) => {
        const existing = newBalances[key];
        if (!existing || 
            existing.balance !== balance.balance || 
            existing.formattedBalance !== balance.formattedBalance ||
            existing.timestamp !== balance.timestamp) {
          newBalances[key] = balance;
          balanceChanges = true;
        }
      });
      return balanceChanges ? { ...state, balances: newBalances } : state;
    
    case 'SET_METADATA':
      return { ...state, metadata: action.payload };
    
    case 'UPDATE_METADATA':
      return { 
        ...state, 
        metadata: { ...state.metadata, [action.payload.contractId]: action.payload.metadata }
      };
    
    case 'SET_CONNECTION_STATUS':
      return { ...state, isConnected: action.payload };
    
    case 'SET_LAST_UPDATE':
      return { ...state, lastUpdate: action.payload };
    
    default:
      return state;
  }
}

interface BlazeProviderProps {
  children: ReactNode;
  host?: string;
}

export function BlazeProvider({ children, host }: BlazeProviderProps) {
  // Optimized state management with useReducer
  const [state, dispatch] = useReducer(blazeReducer, initialState);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Track current balance subscriptions
  const subscribedUsers = useRef<Set<string>>(new Set());
  const socketRefs = useRef<{ prices?: any; balances?: any }>({});

  // Batching queues for performance optimization
  const balanceUpdateQueue = useRef<Array<{ key: string; balance: BalanceData }>>([]);
  const priceUpdateQueue = useRef<PriceData[]>([]);
  const flushTimeout = useRef<NodeJS.Timeout>();

  // Optimized batch processing
  const flushUpdates = useCallback(() => {
    const balanceUpdates = balanceUpdateQueue.current.splice(0);
    const priceUpdates = priceUpdateQueue.current.splice(0);

    if (balanceUpdates.length > 0 || priceUpdates.length > 0) {
      console.log(`BlazeProvider: Flushing ${balanceUpdates.length} balance updates and ${priceUpdates.length} price updates`);
      
      startTransition(() => {
        if (balanceUpdates.length > 0) {
          dispatch({ type: 'BATCH_BALANCE_UPDATES', payload: balanceUpdates });
        }
        if (priceUpdates.length > 0) {
          dispatch({ type: 'BATCH_PRICE_UPDATES', payload: priceUpdates });
        }
        dispatch({ type: 'SET_LAST_UPDATE', payload: Date.now() });
      });
    }
  }, []);

  // Queue balance update for batching (non-blocking)
  const queueBalanceUpdate = useCallback((key: string, balance: BalanceData) => {
    balanceUpdateQueue.current.push({ key, balance });
    
    // Debounced flush - batch updates every 50ms
    clearTimeout(flushTimeout.current);
    flushTimeout.current = setTimeout(flushUpdates, 50);
  }, [flushUpdates]);

  // Queue price update for batching (non-blocking)
  const queuePriceUpdate = useCallback((price: PriceData) => {
    priceUpdateQueue.current.push(price);
    
    // Debounced flush - batch updates every 50ms
    clearTimeout(flushTimeout.current);
    flushTimeout.current = setTimeout(flushUpdates, 50);
  }, [flushUpdates]);

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

          dispatch({ type: 'SET_METADATA', payload: initialMetadata });
          console.log(`BlazeProvider: Initialized metadata for ${tokens.length} tokens`);
          
          // Trigger update notification to client
          dispatch({ type: 'SET_LAST_UPDATE', payload: Date.now() });
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flushTimeout.current) {
        clearTimeout(flushTimeout.current);
      }
    };
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
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: true });
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
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: false });
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
        console.log('BlazeProvider: Queueing price update for', data.contractId, 'price:', data.price);
        queuePriceUpdate({
          contractId: data.contractId,
          price: data.price,
          timestamp: data.timestamp,
          source: data.source || 'realtime'
        });
        break;

      case 'PRICE_BATCH':
        console.log('BlazeProvider: Processing price batch with', data.prices?.length, 'prices');
        data.prices.forEach((price: any) => {
          queuePriceUpdate({
            contractId: price.contractId,
            price: price.price,
            timestamp: price.timestamp,
            source: price.source || 'realtime'
          });
        });
        console.log('BlazeProvider: Queued', data.prices?.length, 'price updates for batch processing');
        break;

      case 'METADATA_UPDATE':
        if (data.contractId && data.metadata) {
          console.log('BlazeProvider: Processing metadata update for', data.contractId);
          dispatch({
            type: 'UPDATE_METADATA',
            payload: {
              contractId: data.contractId,
              metadata: {
                contractId: data.contractId,
                ...data.metadata
              }
            }
          });
          dispatch({ type: 'SET_LAST_UPDATE', payload: Date.now() });
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
          dispatch({ type: 'SET_METADATA', payload: { ...state.metadata, ...newMetadata } });
          dispatch({ type: 'SET_LAST_UPDATE', payload: Date.now() });
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

      case 'SERVER_INFO':
        console.log('BlazeProvider: Balances server info received:', {
          party: data.party,
          isLocalDev: data.isLocalDev,
          metadataLoaded: data.metadataLoaded,
          metadataCount: data.metadataCount,
          initialized: data.initialized,
          timestamp: data.timestamp
        });
        break;

      case 'ERROR':
        console.error('BlazeProvider: Balances server error:', data.message);
        break;
        
      default:
        console.log('BlazeProvider: Unknown balance message type:', data.type);
    }
  }

  function updateBalance(data: any) {
    console.log('BlazeProvider: Queueing balance update for', data.userId, data.contractId);
    
    const key = getBalanceKey(data.userId, data.contractId, data.metadata);
    const existingBalance = state.balances[key];
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

      // Balance metadata (keep existing metadata, don't overwrite with new data)
      metadata: existingBalance?.metadata || {},

      // Preserve existing legacy fields (don't update from balance messages)
      name: existingBalance?.name || data.name,
      symbol: existingBalance?.symbol || data.symbol,
      decimals: existingBalance?.decimals || data.decimals || 6,
      description: existingBalance?.description || data.description,
      image: existingBalance?.image || data.image,
      total_supply: existingBalance?.total_supply || data.total_supply,
      type: existingBalance?.type || data.tokenType,
      identifier: existingBalance?.identifier || data.identifier,
      token_uri: existingBalance?.token_uri || data.token_uri,
      lastUpdated: existingBalance?.lastUpdated || data.lastUpdated,
      tokenAContract: existingBalance?.tokenAContract || data.tokenAContract,
      tokenBContract: existingBalance?.tokenBContract || data.tokenBContract,
      lpRebatePercent: existingBalance?.lpRebatePercent || data.lpRebatePercent,
      externalPoolId: existingBalance?.externalPoolId || data.externalPoolId,
      engineContractId: existingBalance?.engineContractId || data.engineContractId,
      base: existingBalance?.base || data.baseToken
    };

    // Queue the balance update for batching (prevents excessive rerenders)
    queueBalanceUpdate(key, updatedBalance);
  }

  // Optimized utility functions with memoization
  const getPrice = useCallback((contractId: string): number | undefined => {
    return state.prices[contractId]?.price;
  }, [state.prices]);

  const getBalance = useCallback((userId: string, contractId: string): BalanceData | undefined => {
    if (!userId || !contractId || typeof userId !== 'string' || typeof contractId !== 'string') {
      return undefined;
    }
    const key = getBalanceKey(userId.trim(), contractId.trim());
    return state.balances[key];
  }, [state.balances]);

  const getMetadata = useCallback((contractId: string): TokenMetadata | undefined => {
    return state.metadata[contractId];
  }, [state.metadata]);

  const getUserBalances = useCallback((userId?: string | null): Record<string, BalanceData> => {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return {};
    }

    const trimmedUserId = userId.trim();
    const userBalances: Record<string, BalanceData> = {};

    Object.entries(state.balances).forEach(([key, balance]) => {
      if (key.startsWith(`${trimmedUserId}:`)) {
        const contractId = key.substring(trimmedUserId.length + 1);
        userBalances[contractId] = balance;
      }
    });

    return userBalances;
  }, [state.balances]);

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

  // Optimized context value with memoization - only recreates when necessary
  const contextValue: BlazeContextType = useMemo(() => ({
    prices: state.prices,
    balances: state.balances,
    metadata: state.metadata,
    isConnected: state.isConnected,
    lastUpdate: state.lastUpdate,
    isInitialized,
    getPrice,
    getBalance,
    getMetadata,
    getUserBalances,
    _subscribeToUserBalances: subscribeToUserBalances,
    _unsubscribeFromUserBalances: unsubscribeFromUserBalances,
    refreshBalances
  }), [
    state.prices,
    state.balances,
    state.metadata,
    state.isConnected,
    state.lastUpdate,
    isInitialized,
    getPrice,
    getBalance,
    getMetadata,
    getUserBalances
  ]);

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