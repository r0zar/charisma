/**
 * useOptimizedBlaze - Custom hook that wraps useBlaze with optimized price subscriptions
 * Only subscribes to prices for tokens that are actively being displayed
 */

import { useEffect, useRef, useCallback } from 'react';
import { useBlaze } from 'blaze-sdk/realtime';
import usePartySocket from 'partysocket/react';

interface OptimizedBlazeConfig {
  userId?: string;
  watchedTokens?: string[]; // Specific tokens to watch for prices
}

interface OptimizedBlazeData {
  prices: Record<string, any>;
  balances: Record<string, any>;
  metadata: Record<string, any>;
  isConnected: boolean;
  lastUpdate: number;
  getPrice: (contractId: string) => number | undefined;
  getBalance: (userId: string, contractId: string) => any | undefined;
  getMetadata: (contractId: string) => any | undefined;
  updateWatchedTokens: (tokens: string[]) => void;
}

export function useOptimizedBlaze(config: OptimizedBlazeConfig = {}): OptimizedBlazeData {
  const { userId, watchedTokens = [] } = config;
  
  // Use the original useBlaze for balances and basic functionality
  const blazeData = useBlaze({ userId });
  
  // Track current watched tokens
  const currentWatchedTokens = useRef<string[]>([]);
  const hasInitialSubscription = useRef(false);
  
  // Determine host based on environment (same logic as BlazeProvider)
  const isDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const partyHost = isDev ?
    (typeof window !== 'undefined' ? `${window.location.hostname}:1999` : 'localhost:1999') :
    'charisma-party.r0zar.partykit.dev';
  
  // Create our own prices socket for optimized subscriptions
  const optimizedPricesSocket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'prices',
    onOpen: () => {
      console.log('✅ OptimizedBlaze: Connected to prices server');
      // Subscribe to current watched tokens on connection
      if (currentWatchedTokens.current.length > 0) {
        subscribeToTokens(currentWatchedTokens.current);
      }
    },
    onClose: () => {
      console.log('🔌 OptimizedBlaze: Disconnected from prices server');
    },
    onMessage: (event) => {
      // We don't need to handle messages here since the original useBlaze handles them
      // This socket is just for managing subscriptions
    }
  });
  
  // Function to subscribe to specific tokens
  const subscribeToTokens = useCallback((tokens: string[]) => {
    if (!optimizedPricesSocket || optimizedPricesSocket.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ OptimizedBlaze: Cannot subscribe - socket not ready');
      return;
    }
    
    const validTokens = tokens.filter(token => token && typeof token === 'string');
    
    if (validTokens.length === 0) {
      console.log('📊 OptimizedBlaze: No valid tokens to subscribe to, subscribing to all');
      // Fallback to all prices if no specific tokens
      optimizedPricesSocket.send(JSON.stringify({
        type: 'SUBSCRIBE',
        contractIds: [], // Empty = subscribe to all
        clientId: 'optimized-blaze'
      }));
      return;
    }
    
    console.log(`📊 OptimizedBlaze: Subscribing to ${validTokens.length} specific tokens:`, validTokens.slice(0, 5));
    
    optimizedPricesSocket.send(JSON.stringify({
      type: 'SUBSCRIBE',
      contractIds: validTokens,
      clientId: 'optimized-blaze'
    }));
  }, [optimizedPricesSocket]);
  
  // Function to update watched tokens dynamically
  const updateWatchedTokens = useCallback((newTokens: string[]) => {
    const newTokensSet = new Set(newTokens);
    const currentTokensSet = new Set(currentWatchedTokens.current);
    
    // Check if tokens have actually changed
    const hasChanged = newTokensSet.size !== currentTokensSet.size || 
      !Array.from(newTokensSet).every(token => currentTokensSet.has(token));
    
    if (!hasChanged) {
      return; // No change needed
    }
    
    console.log(`📊 OptimizedBlaze: Updating watched tokens from ${currentWatchedTokens.current.length} to ${newTokens.length}`);
    
    currentWatchedTokens.current = newTokens;
    subscribeToTokens(newTokens);
  }, [subscribeToTokens]);
  
  // Initial subscription and updates when watchedTokens prop changes
  useEffect(() => {
    if (!hasInitialSubscription.current) {
      hasInitialSubscription.current = true;
      currentWatchedTokens.current = watchedTokens;
      
      // Small delay to ensure socket is ready
      setTimeout(() => {
        subscribeToTokens(watchedTokens);
      }, 100);
    } else {
      updateWatchedTokens(watchedTokens);
    }
  }, [watchedTokens, subscribeToTokens]); // Removed updateWatchedTokens from deps
  
  return {
    ...blazeData,
    updateWatchedTokens
  };
}