'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { KraxelPriceData } from '@/lib/contract-registry-adapter';
import { getPrices } from '../app/actions';
import { lakehouseClient } from '@repo/tokens';

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
  const [tryDataClient, setTryDataClient] = useState(true); // Simple flag to try data client

  const refreshPrices = useCallback(async () => {
    try {
      setError(null);
      
      // Try data client first (simple, clean integration)
      if (tryDataClient) {
        console.log('[TokenPriceContext] Trying lakehouse client for price refresh');
        try {
          const priceArray = await lakehouseClient.getCurrentPrices({ limit: 50 });
          
          // Convert array to KraxelPriceData format (simple conversion)
          const priceData: KraxelPriceData = {};
          priceArray.forEach(price => {
            priceData[price.token_contract_id] = price.usd_price;
          });
          
          setPrices(priceData);
          setLastUpdate(Date.now());
          console.log(`[TokenPriceContext] ✓ Lakehouse client success: ${Object.keys(priceData).length} prices`);
          return; // Success - exit early
        } catch (lakehouseError) {
          console.warn('[TokenPriceContext] Lakehouse client failed, falling back:', lakehouseError);
          setTryDataClient(false); // Disable for this session
        }
      }
      
      // Fallback to original method
      console.log('[TokenPriceContext] Using original price fetching method');
      const priceData = await getPrices();
      setPrices(priceData);
      setLastUpdate(Date.now());
    } catch (err) {
      console.error('Failed to fetch token prices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
    } finally {
      setIsLoading(false);
    }
  }, [tryDataClient]);

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