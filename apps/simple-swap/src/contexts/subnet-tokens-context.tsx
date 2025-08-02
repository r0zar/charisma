'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface SubnetTokenInfo {
  contractId: string;
  base: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface SubnetTokensContextType {
  subnetTokens: SubnetTokenInfo[];
  pairings: Record<string, string>; // mainnet contractId -> subnet contractId
  isLoading: boolean;
  error: string | null;
  getSubnetContractId: (mainnetContractId: string) => string | null;
  refreshSubnetTokens: () => Promise<void>;
}

const SubnetTokensContext = createContext<SubnetTokensContextType | undefined>(undefined);

interface SubnetTokensProviderProps {
  children: ReactNode;
}

export function SubnetTokensProvider({ children }: SubnetTokensProviderProps) {
  const [subnetTokens, setSubnetTokens] = useState<SubnetTokenInfo[]>([]);
  const [pairings, setPairings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubnetTokens = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/v1/subnet-tokens');
      const data = await response.json();
      
      if (data.success) {
        setSubnetTokens(data.subnetTokens);
        setPairings(data.pairings);
        console.log(`[SubnetTokensContext] Loaded ${data.subnetTokens.length} subnet tokens`);
      } else {
        throw new Error(data.error || 'Failed to fetch subnet tokens');
      }
      
    } catch (err) {
      console.error('[SubnetTokensContext] Error fetching subnet tokens:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Get subnet contract ID for a given mainnet contract ID
  const getSubnetContractId = (mainnetContractId: string): string | null => {
    return pairings[mainnetContractId] || null;
  };

  // Initial load
  useEffect(() => {
    fetchSubnetTokens();
  }, []);

  const contextValue: SubnetTokensContextType = {
    subnetTokens,
    pairings,
    isLoading,
    error,
    getSubnetContractId,
    refreshSubnetTokens: fetchSubnetTokens,
  };

  return (
    <SubnetTokensContext.Provider value={contextValue}>
      {children}
    </SubnetTokensContext.Provider>
  );
}

export function useSubnetTokens(): SubnetTokensContextType {
  const context = useContext(SubnetTokensContext);
  if (!context) {
    throw new Error('useSubnetTokens must be used within a SubnetTokensProvider');
  }
  return context;
}