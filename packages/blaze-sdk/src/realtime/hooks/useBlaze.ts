'use client';

/**
 * useBlaze - Simple direct connection to PartyKit servers
 * This is the working version that connects directly without complex providers
 */

import { useState } from 'react';
import usePartySocket from 'partysocket/react';

// Simple working useBlaze hook that connects directly to PartyKit
export function useBlaze() {
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [metadata, setMetadata] = useState<Record<string, any>>({});
  const [balances, setBalances] = useState<Record<string, any>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Determine host based on environment
  const isDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const partyHost = isDev ? 
    (typeof window !== 'undefined' ? `${window.location.hostname}:1999` : 'localhost:1999') : 
    'charisma-party.r0zar.partykit.dev';

  // Prices socket
  const pricesSocket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'prices',
    onOpen: () => {
      console.log('✅ Connected to prices server');
      setIsConnected(true);
      // Subscribe to all prices
      if (pricesSocket) {
        pricesSocket.send(JSON.stringify({
          type: 'SUBSCRIBE',
          contractIds: [], // Empty = subscribe to all
          clientId: 'blaze-sdk'
        }));
      }
    },
    onClose: () => {
      console.log('🔌 Disconnected from prices server');
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
                price: data.price,
                timestamp: data.timestamp,
                source: data.source
              }
            }));
            setLastUpdate(Date.now());
            break;

          case 'PRICE_BATCH':
            const newPrices: Record<string, any> = {};
            data.prices.forEach((price: any) => {
              newPrices[price.contractId] = {
                price: price.price,
                timestamp: price.timestamp,
                source: price.source
              };
            });
            setPrices(prev => ({ ...prev, ...newPrices }));
            setLastUpdate(Date.now());
            break;

          case 'SERVER_INFO':
            console.log('Prices server info:', data);
            break;

          case 'ERROR':
            console.error('Prices server error:', data.message);
            break;
        }
      } catch (error) {
        console.error('Error parsing prices message:', error);
      }
    }
  });

  // Metadata socket
  const metadataSocket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'metadata',
    onOpen: () => {
      console.log('✅ Connected to metadata server');
      // Subscribe to all metadata
      if (metadataSocket) {
        metadataSocket.send(JSON.stringify({
          type: 'SUBSCRIBE',
          contractIds: [], // Empty = subscribe to all
          clientId: 'blaze-sdk'
        }));
      }
    },
    onClose: () => {
      console.log('🔌 Disconnected from metadata server');
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'METADATA_UPDATE':
            setMetadata(prev => ({
              ...prev,
              [data.contractId]: {
                contractId: data.contractId,
                name: data.metadata.name || 'Unknown Token',
                symbol: data.metadata.symbol || 'TKN',
                decimals: data.metadata.decimals || 6,
                imageUrl: data.metadata.image,
                verified: true,
                timestamp: data.timestamp || Date.now()
              }
            }));
            setLastUpdate(Date.now());
            break;

          case 'METADATA_BATCH':
            const newMetadata: Record<string, any> = {};
            data.metadata.forEach((meta: any) => {
              newMetadata[meta.contractId] = {
                contractId: meta.contractId,
                name: meta.metadata.name || 'Unknown Token',
                symbol: meta.metadata.symbol || 'TKN',
                decimals: meta.metadata.decimals || 6,
                imageUrl: meta.metadata.image,
                verified: true,
                timestamp: meta.timestamp || Date.now()
              };
            });
            setMetadata(prev => ({ ...prev, ...newMetadata }));
            setLastUpdate(Date.now());
            break;

          case 'SERVER_INFO':
            console.log('Metadata server info:', data);
            break;

          case 'ERROR':
            console.error('Metadata server error:', data.message);
            break;
        }
      } catch (error) {
        console.error('Error parsing metadata message:', error);
      }
    }
  });

  // Balances socket
  const balancesSocket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'balances',
    onOpen: () => {
      console.log('✅ Connected to balances server');
      // Subscribe to all balances
      if (balancesSocket) {
        balancesSocket.send(JSON.stringify({
          type: 'SUBSCRIBE',
          userIds: [], // Empty = subscribe to all
          clientId: 'blaze-sdk'
        }));
      }
    },
    onClose: () => {
      console.log('🔌 Disconnected from balances server');
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
            if (data.balances && Array.isArray(data.balances)) {
              const newBalances: Record<string, any> = {};
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
              setBalances(prev => ({ ...prev, ...newBalances }));
              setLastUpdate(Date.now());
            }
            break;

          case 'SERVER_INFO':
            console.log('Balances server info:', data);
            break;

          case 'ERROR':
            console.error('Balances server error:', data.message);
            break;
        }
      } catch (error) {
        console.error('Error parsing balances message:', error);
      }
    }
  });

  return {
    prices,
    metadata,
    balances,
    isConnected,
    lastUpdate
  };
}