'use client';

import React, { createContext, useState, useEffect } from 'react';
import usePartySocket from 'partysocket/react';

interface TokensContextType {
  metadata: Record<string, any>;
  balances: Record<string, any>;
  prices: Record<string, any>;
  isConnected: boolean;
  isLoading: boolean;
  lastUpdate: number;
  connectionMode: 'static' | 'realtime' | 'disconnected';
  subscriptionId: string;
  getTokenMetadata: (contractId: string) => any;
  getUserBalance: (userId: string, contractId: string) => any;
  getTokenPrice: (contractId: string) => any;
  getUserPortfolio: (userId: string) => any;
  _internal?: {
    addSubscription: (id: string, config: any) => void;
    removeSubscription: (id: string) => void;
    getFilteredData: (id: string) => any;
  };
}

export const TokensContext = createContext<TokensContextType | undefined>(undefined);

interface TokensProviderProps {
  children: React.ReactNode;
  host?: string;
}

export const TokensProvider: React.FC<TokensProviderProps> = ({ 
  children, 
  host 
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Determine host based on environment
  const isDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  const partyHost = host || (isDev ?
    (typeof window !== 'undefined' ? `${window.location.hostname}:1999` : 'localhost:1999') :
    'charisma-party.r0zar.partykit.dev');

  // Simple PartySocket connection
  const socket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'tokens',
    onOpen: () => {
      console.log('✅ TokensProvider: Connected');
      setIsConnected(true);
    },
    onClose: () => {
      console.log('🔌 TokensProvider: Disconnected');
      setIsConnected(false);
    },
    onError: (error) => {
      console.error('❌ TokensProvider: Error:', error);
    },
    onMessage: (event) => {
      console.log('📨 TokensProvider: Message:', event.data);
      setLastUpdate(Date.now());
    },
  });

  const contextValue: TokensContextType = {
    metadata: {},
    balances: {},
    prices: {},
    isConnected,
    isLoading: false,
    lastUpdate,
    connectionMode: isConnected ? 'realtime' : 'disconnected',
    subscriptionId: '',
    getTokenMetadata: () => undefined,
    getUserBalance: () => undefined, 
    getTokenPrice: () => undefined,
    getUserPortfolio: () => ({}),
    _internal: {
      addSubscription: () => {},
      removeSubscription: () => {},
      getFilteredData: () => ({ metadata: {}, balances: {}, prices: {}, isLoading: false, subscriptionId: '' })
    }
  };

  return (
    <TokensContext.Provider value={contextValue}>
      {children}
    </TokensContext.Provider>
  );
};