'use client';

/**
 * BlazeProvider - Global connection provider for real-time data
 * Manages WebSocket connections and React state for all real-time data
 */

import React, { createContext, useContext, useReducer, ReactNode, Dispatch } from 'react';
import usePartySocket from 'partysocket/react';
import { blazeReducer, initialState, stateUtils, BlazeState, BlazeAction } from '../state/reducer';
import { 
  BlazeProviderConfig, 
  ServerMessage,
  PriceUpdateMessage,
  PriceBatchMessage,
  BalanceUpdateMessage,
  MetadataUpdateMessage
} from '../types';

interface BlazeContextValue {
  state: BlazeState;
  dispatch: Dispatch<BlazeAction>;
  pricesSocket: any;
  balancesSocket: any;
  metadataSocket: any;
  // Utility functions
  getPrice: (contractId: string) => number | undefined;
  formatPrice: (contractId: string) => string;
  getBalance: (userId: string, contractId: string) => any;
  getMetadata: (contractId: string) => any;
  isConnected: boolean;
  lastUpdate: number;
}

const BlazeContext = createContext<BlazeContextValue | null>(null);

interface BlazeProviderProps {
  children: ReactNode;
  host?: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export function BlazeProvider({ 
  children, 
  host = 'localhost:1999',
  reconnectAttempts = 10,
  reconnectDelay = 1000
}: BlazeProviderProps) {
  // Central state management with useReducer
  const [state, dispatch] = useReducer(blazeReducer, initialState);

  // Message handlers that dispatch actions
  const handlePricesMessage = (event: MessageEvent) => {
    try {
      const data: ServerMessage = JSON.parse(event.data);

      switch (data.type) {
        case 'PRICE_UPDATE':
          const priceUpdate = data as PriceUpdateMessage;
          dispatch({
            type: 'PRICE_UPDATE',
            contractId: priceUpdate.contractId,
            price: priceUpdate.price,
            timestamp: priceUpdate.timestamp,
            source: priceUpdate.source
          });
          break;

        case 'PRICE_BATCH':
          const priceBatch = data as PriceBatchMessage;
          dispatch({
            type: 'PRICE_BATCH',
            prices: priceBatch.prices
          });
          break;

        case 'ERROR':
          console.error('Prices server error:', data.message);
          break;

        case 'SERVER_INFO':
          console.log('Prices server info:', data);
          break;
      }
    } catch (error) {
      console.error('Error parsing prices message:', error);
    }
  };

  const handleBalancesMessage = (event: MessageEvent) => {
    try {
      const data: ServerMessage = JSON.parse(event.data);

      switch (data.type) {
        case 'BALANCE_UPDATE':
          // Extract base contractId (before :: if present)
          const baseContractId = data.contractId?.split('::')[0];
          if (baseContractId && data.userId && data.balance !== undefined) {
            dispatch({
              type: 'BALANCE_UPDATE',
              userId: data.userId,
              contractId: baseContractId,
              balance: {
                balance: data.balance,
                totalSent: data.totalSent || '0',
                totalReceived: data.totalReceived || '0',
                timestamp: data.timestamp || Date.now(),
                source: data.source || 'realtime'
              }
            });
          }
          break;

        case 'BALANCE_BATCH':
          if (data.balances && Array.isArray(data.balances)) {
            data.balances.forEach((balance: any) => {
              const baseContractId = balance.contractId?.split('::')[0];
              if (baseContractId && balance.userId && balance.balance !== undefined) {
                dispatch({
                  type: 'BALANCE_UPDATE',
                  userId: balance.userId,
                  contractId: baseContractId,
                  balance: {
                    balance: balance.balance,
                    totalSent: balance.totalSent || '0',
                    totalReceived: balance.totalReceived || '0',
                    timestamp: balance.timestamp || Date.now(),
                    source: balance.source || 'realtime'
                  }
                });
              }
            });
          }
          break;

        case 'ERROR':
          console.error('Balances server error:', data.message);
          break;

        case 'SERVER_INFO':
          console.log('Balances server info:', data);
          break;
      }
    } catch (error) {
      console.error('Error parsing balances message:', error);
    }
  };

  const handleMetadataMessage = (event: MessageEvent) => {
    try {
      const data: ServerMessage = JSON.parse(event.data);

      switch (data.type) {
        case 'METADATA_UPDATE':
          if (data.contractId && data.metadata) {
            dispatch({
              type: 'METADATA_UPDATE',
              contractId: data.contractId,
              metadata: {
                contractId: data.contractId,
                name: data.metadata.name || 'Unknown Token',
                symbol: data.metadata.symbol || 'TKN',
                decimals: data.metadata.decimals || 6,
                imageUrl: data.metadata.image,
                verified: true,
                timestamp: data.timestamp || Date.now()
              }
            });
          }
          break;

        case 'METADATA_BATCH':
          if (data.metadata && Array.isArray(data.metadata)) {
            data.metadata.forEach((meta: any) => {
              if (meta.contractId && meta.metadata) {
                dispatch({
                  type: 'METADATA_UPDATE',
                  contractId: meta.contractId,
                  metadata: {
                    contractId: meta.contractId,
                    name: meta.metadata.name || 'Unknown Token',
                    symbol: meta.metadata.symbol || 'TKN',
                    decimals: meta.metadata.decimals || 6,
                    imageUrl: meta.metadata.image,
                    verified: true,
                    timestamp: meta.timestamp || Date.now()
                  }
                });
              }
            });
          }
          break;

        case 'ERROR':
          console.error('Metadata server error:', data.message);
          break;

        case 'SERVER_INFO':
          console.log('Metadata server info:', data);
          break;
      }
    } catch (error) {
      console.error('Error parsing metadata message:', error);
    }
  };

  // Determine host based on environment
  const isDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const partyHost = isDev ? 
    (typeof window !== 'undefined' ? `${window.location.hostname}:1999` : host) : 
    'charisma-party.r0zar.partykit.dev';

  // Prices connection
  const pricesSocket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'prices',
    onOpen: () => {
      console.log('✅ Connected to prices server');
      dispatch({ type: 'PRICES_CONNECTION', connected: true });
    },
    onClose: () => {
      console.log('🔌 Disconnected from prices server');
      dispatch({ type: 'PRICES_CONNECTION', connected: false });
    },
    onError: (error) => {
      console.error('Prices server connection error:', error);
      dispatch({ type: 'PRICES_CONNECTION', connected: false });
    },
    onMessage: handlePricesMessage
  });

  // Balances connection (future implementation)
  const balancesSocket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'balances',
    onOpen: () => {
      console.log('✅ Connected to balances server');
      dispatch({ type: 'BALANCES_CONNECTION', connected: true });
    },
    onClose: () => {
      console.log('🔌 Disconnected from balances server');
      dispatch({ type: 'BALANCES_CONNECTION', connected: false });
    },
    onError: (error) => {
      console.error('Balances server connection error:', error);
      dispatch({ type: 'BALANCES_CONNECTION', connected: false });
    },
    onMessage: handleBalancesMessage
  });

  // Metadata connection (future implementation)
  const metadataSocket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'metadata',
    onOpen: () => {
      console.log('✅ Connected to metadata server');
      dispatch({ type: 'METADATA_CONNECTION', connected: true });
    },
    onClose: () => {
      console.log('🔌 Disconnected from metadata server');
      dispatch({ type: 'METADATA_CONNECTION', connected: false });
    },
    onError: (error) => {
      console.error('Metadata server connection error:', error);
      dispatch({ type: 'METADATA_CONNECTION', connected: false });
    },
    onMessage: handleMetadataMessage
  });

  // Create context value with state and utility functions
  const contextValue: BlazeContextValue = {
    state,
    dispatch,
    pricesSocket,
    balancesSocket,
    metadataSocket,
    
    // Utility functions using state
    getPrice: (contractId: string) => stateUtils.getPrice(state, contractId),
    formatPrice: (contractId: string) => stateUtils.formatPrice(state, contractId),
    getBalance: (userId: string, contractId: string) => stateUtils.getBalance(state, userId, contractId),
    getMetadata: (contractId: string) => stateUtils.getMetadata(state, contractId),
    isConnected: stateUtils.isConnected(state),
    lastUpdate: stateUtils.getLastUpdate(state)
  };

  return (
    <BlazeContext.Provider value={contextValue}>
      {children}
    </BlazeContext.Provider>
  );
}

export function useBlazeContext() {
  const context = useContext(BlazeContext);
  if (!context) {
    throw new Error('useBlazeContext must be used within a BlazeProvider');
  }
  return context;
}