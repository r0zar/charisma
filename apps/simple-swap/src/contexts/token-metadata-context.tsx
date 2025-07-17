'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { listTokens, TokenCacheData } from '@repo/tokens';

interface TokenMetadataContextType {
  tokens: Record<string, TokenCacheData>;
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
  refreshTokens: () => Promise<void>;
  getToken: (contractId: string) => TokenCacheData | null;
  getTokenSymbol: (contractId: string) => string;
  getTokenName: (contractId: string) => string;
  getTokenImage: (contractId: string) => string | null;
  getTokenDecimals: (contractId: string) => number;
}

const TokenMetadataContext = createContext<TokenMetadataContextType | undefined>(undefined);

export function useTokenMetadata(): TokenMetadataContextType {
  const context = useContext(TokenMetadataContext);
  if (!context) {
    throw new Error('useTokenMetadata must be used within a TokenMetadataProvider');
  }
  return context;
}

interface TokenMetadataProviderProps {
  children: ReactNode;
  refreshInterval?: number; // in milliseconds, default 5 minutes
}

export function TokenMetadataProvider({ children, refreshInterval = 300000 }: TokenMetadataProviderProps) {
  const [tokens, setTokens] = useState<Record<string, TokenCacheData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const refreshTokens = useCallback(async () => {
    try {
      setError(null);
      const tokenData = await listTokens();
      
      // Convert array to record for easier access
      const tokenRecord: Record<string, TokenCacheData> = {};
      tokenData.forEach((token: TokenCacheData) => {
        tokenRecord[token.contractId] = token;
      });
      
      setTokens(tokenRecord);
      setLastUpdate(Date.now());
    } catch (err) {
      console.error('Failed to fetch token metadata:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch token metadata');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getToken = useCallback((contractId: string): TokenCacheData | null => {
    return tokens[contractId] || null;
  }, [tokens]);

  const getTokenSymbol = useCallback((contractId: string): string => {
    const token = tokens[contractId];
    return token?.symbol || 'Unknown';
  }, [tokens]);

  const getTokenName = useCallback((contractId: string): string => {
    const token = tokens[contractId];
    return token?.name || 'Unknown Token';
  }, [tokens]);

  const getTokenImage = useCallback((contractId: string): string | null => {
    const token = tokens[contractId];
    return token?.image || null;
  }, [tokens]);

  const getTokenDecimals = useCallback((contractId: string): number => {
    const token = tokens[contractId];
    return token?.decimals || 6;
  }, [tokens]);

  // Initial load
  useEffect(() => {
    refreshTokens();
  }, [refreshTokens]);

  // Set up polling for token metadata updates
  useEffect(() => {
    const interval = setInterval(refreshTokens, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshTokens, refreshInterval]);

  const contextValue: TokenMetadataContextType = {
    tokens,
    isLoading,
    error,
    lastUpdate,
    refreshTokens,
    getToken,
    getTokenSymbol,
    getTokenName,
    getTokenImage,
    getTokenDecimals,
  };

  return (
    <TokenMetadataContext.Provider value={contextValue}>
      {children}
    </TokenMetadataContext.Provider>
  );
}

// Convenience hook that matches common usage patterns
export function useTokenInfo(contractId?: string) {
  const { 
    tokens, 
    isLoading, 
    error, 
    getToken, 
    getTokenSymbol, 
    getTokenName, 
    getTokenImage, 
    getTokenDecimals,
    lastUpdate
  } = useTokenMetadata();

  if (!contractId) {
    return {
      tokens,
      isLoading,
      error,
      getToken,
      getTokenSymbol,
      getTokenName,
      getTokenImage,
      getTokenDecimals,
      lastUpdate,
    };
  }

  const token = getToken(contractId);
  
  return {
    token,
    symbol: getTokenSymbol(contractId),
    name: getTokenName(contractId),
    image: getTokenImage(contractId),
    decimals: getTokenDecimals(contractId),
    isLoading,
    error,
    lastUpdate,
  };
}