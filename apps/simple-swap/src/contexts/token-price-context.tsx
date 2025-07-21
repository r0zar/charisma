'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { KraxelPriceData } from '@/lib/contract-registry-adapter';
import { getPrices } from '../app/actions';

interface TokenPriceContextType {
  prices: KraxelPriceData;
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
  refreshPrices: () => Promise<void>;
  getPrice: (contractId: string) => number | null;
}

const TokenPriceContext = createContext<TokenPriceContextType | undefined>(undefined);

export function useTokenPrices(): TokenPriceContextType {
  const context = useContext(TokenPriceContext);
  if (!context) {
    throw new Error('useTokenPrices must be used within a TokenPriceProvider');
  }
  return context;
}

interface TokenPriceProviderProps {
  children: ReactNode;
  refreshInterval?: number; // in milliseconds, default 30 seconds
}

export function TokenPriceProvider({ children, refreshInterval = 30000 }: TokenPriceProviderProps) {
  const [prices, setPrices] = useState<KraxelPriceData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const refreshPrices = useCallback(async () => {
    try {
      setError(null);
      const priceData = await getPrices();
      setPrices(priceData);
      setLastUpdate(Date.now());
    } catch (err) {
      console.error('Failed to fetch token prices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getPrice = useCallback((contractId: string): number | null => {
    return prices[contractId] || null;
  }, [prices]);

  // Initial load
  useEffect(() => {
    refreshPrices();
  }, [refreshPrices]);

  // Set up polling for price updates
  useEffect(() => {
    const interval = setInterval(refreshPrices, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshPrices, refreshInterval]);

  const contextValue: TokenPriceContextType = {
    prices,
    isLoading,
    error,
    lastUpdate,
    refreshPrices,
    getPrice,
  };

  return (
    <TokenPriceContext.Provider value={contextValue}>
      {children}
    </TokenPriceContext.Provider>
  );
}

// Convenience hook for price operations
export function usePrices() {
  const { prices, getPrice, isLoading, error, lastUpdate } = useTokenPrices();
  
  return {
    prices,
    getPrice,
    isLoading,
    error,
    lastUpdate,
  };
}