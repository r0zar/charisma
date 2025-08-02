'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { getTokenMetadataAction, discoverMissingTokenAction } from '@/app/actions';

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
  discoverMissingToken: (contractId: string) => Promise<TokenCacheData | null>;
  getTokenWithDiscovery: (contractId: string) => Promise<TokenCacheData | null>;
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
  initialTokens?: TokenCacheData[]; // SSR data to initialize context
}

export function TokenMetadataProvider({ children, initialTokens }: TokenMetadataProviderProps) {
  // This provider now relies on SSR data from RootLayout with Next.js revalidation (5 minutes)
  // No client-side polling is used - data freshness is handled by Next.js ISR
  // Dynamic discovery is still available for missing tokens

  // Initialize with SSR data if available
  const [tokens, setTokens] = useState<Record<string, TokenCacheData>>(() => {
    if (initialTokens) {
      console.log(`[TokenMetadataProvider] Initializing with ${initialTokens.length} SSR tokens`);
      
      // Debug: Check for USDh tokens in SSR data
      const usdhTokens = initialTokens.filter(t => t.contractId.toLowerCase().includes('usdh'));
      console.log(`[TokenMetadataProvider] Found ${usdhTokens.length} USDh tokens in SSR:`, usdhTokens.map(t => ({ contractId: t.contractId, decimals: t.decimals })));
      
      const tokenRecord: Record<string, TokenCacheData> = {};
      initialTokens.forEach((token: TokenCacheData) => {
        tokenRecord[token.contractId] = token;
      });

      return tokenRecord;
    }
    console.log('[TokenMetadataProvider] No SSR tokens provided, will fetch client-side');
    return {};
  });
  const [isLoading, setIsLoading] = useState(!initialTokens); // Not loading if we have initial data
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const refreshTokens = useCallback(async () => {
    try {
      setError(null);
      const result = await getTokenMetadataAction();

      if (!result.success || !result.tokens) {
        throw new Error(result.error || 'Failed to fetch token metadata');
      }

      console.log(`[TokenMetadataContext] Loaded ${result.tokens.length} tokens into context`);

      // Convert array to record for easier access
      const tokenRecord: Record<string, TokenCacheData> = {};
      result.tokens.forEach((token: TokenCacheData) => {
        tokenRecord[token.contractId] = token;
      });

      // Log some sample tokens for debugging
      const sampleTokens = result.tokens.slice(0, 5).map(t => ({
        contractId: t.contractId,
        symbol: t.symbol,
        name: t.name
      }));
      console.log('[TokenMetadataContext] Sample loaded tokens:', sampleTokens);

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

  const discoverMissingToken = useCallback(async (contractId: string): Promise<TokenCacheData | null> => {
    try {
      console.log(`[TokenMetadataProvider] Attempting to discover missing token: ${contractId}`);

      const result = await discoverMissingTokenAction(contractId);

      if (result.success && result.token) {
        console.log(`[TokenMetadataProvider] Successfully discovered token: ${contractId} (${result.token.symbol})`);

        // Add the discovered token to our local state
        setTokens(prevTokens => ({
          ...prevTokens,
          [contractId]: result.token!
        }));

        // Update last update timestamp
        setLastUpdate(Date.now());

        return result.token;
      } else {
        console.warn(`[TokenMetadataProvider] Failed to discover token: ${contractId}`, result.error);
        return null;
      }
    } catch (error) {
      console.error(`[TokenMetadataProvider] Error discovering token ${contractId}:`, error);
      return null;
    }
  }, []);

  const getTokenWithDiscovery = useCallback(async (contractId: string): Promise<TokenCacheData | null> => {
    // First try to get from existing tokens
    const existingToken = tokens[contractId];
    if (existingToken) {
      return existingToken;
    }

    // If not found, attempt discovery
    console.log(`[TokenMetadataProvider] Token ${contractId} not found in context, attempting discovery`);
    return await discoverMissingToken(contractId);
  }, [tokens, discoverMissingToken]);

  // Initial load only if no SSR data provided
  useEffect(() => {
    if (!initialTokens || initialTokens.length === 0) {
      console.log('[TokenMetadataProvider] No SSR data provided, fetching client-side');
      refreshTokens();
    } else {
      console.log('[TokenMetadataProvider] Using SSR data, no client-side fetch needed');
    }
  }, [refreshTokens, initialTokens]);

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
    discoverMissingToken,
    getTokenWithDiscovery,
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
    lastUpdate,
    discoverMissingToken,
    getTokenWithDiscovery
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
      discoverMissingToken,
      getTokenWithDiscovery,
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
    discoverMissingToken,
    getTokenWithDiscovery,
  };
}