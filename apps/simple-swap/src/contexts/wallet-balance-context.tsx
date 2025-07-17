'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { AccountBalancesResponse } from '@repo/polyglot';
import { getAccountBalancesWithSubnet } from '@/app/actions';
import { formatTokenAmount } from '@/lib/swap-utils';
import { useTokenMetadata } from './token-metadata-context';

interface WalletBalanceContextType {
  balances: Record<string, AccountBalancesResponse>;
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
  refreshBalances: (addresses?: string[]) => Promise<void>;
  getBalance: (address: string) => AccountBalancesResponse | null;
  getTokenBalance: (address: string, contractId: string) => number;
  getSubnetBalance: (address: string, contractId: string) => number;
  getSubnetTokenBalance: (address: string, subnetContractId: string) => number;
  getStxBalance: (address: string) => number;
  getFormattedMainnetBalance: (address: string, contractId: string) => string;
  getFormattedSubnetBalance: (address: string, contractId: string) => string;
  addWalletAddress: (address: string) => void;
  removeWalletAddress: (address: string) => void;
  watchedAddresses: string[];
}

const WalletBalanceContext = createContext<WalletBalanceContextType | undefined>(undefined);

interface WalletBalanceProviderProps {
  children: ReactNode;
  refreshInterval?: number;
}

export function WalletBalanceProvider({ children, refreshInterval = 60000 }: WalletBalanceProviderProps) {
  const [balances, setBalances] = useState<Record<string, AccountBalancesResponse>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [watchedAddresses, setWatchedAddresses] = useState<string[]>([]);
  
  const { tokens } = useTokenMetadata();
  
  // Use refs to track active requests and prevent duplicates
  const activeRequests = useRef(new Set<string>());
  const intervalRef = useRef<NodeJS.Timeout | undefined>();

  const isValidStacksAddress = (address: string): boolean => {
    return Boolean(address && (address.startsWith('SP') || address.startsWith('ST')));
  };

  const refreshBalances = async (addresses?: string[]) => {
    const addressesToUpdate = addresses || watchedAddresses;
    if (addressesToUpdate.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled(
        addressesToUpdate.map(async (address) => {
          // Skip if request is already active for this address
          if (activeRequests.current.has(address)) {
            return null;
          }

          if (!isValidStacksAddress(address)) {
            return null;
          }

          activeRequests.current.add(address);
          
          try {
            const balanceData = await getAccountBalancesWithSubnet(address, { trim: true });
            return { address, balanceData };
          } catch (err) {
            console.error(`Failed to fetch balance for ${address}:`, err);
            return null;
          } finally {
            activeRequests.current.delete(address);
          }
        })
      );

      const newBalances = { ...balances };
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value && result.value.balanceData) {
          newBalances[result.value.address] = result.value.balanceData;
        }
      });

      setBalances(newBalances);
      setLastUpdate(Date.now());
    } catch (err) {
      console.error('Failed to refresh balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh balances');
    } finally {
      setIsLoading(false);
    }
  };

  const getBalance = (address: string): AccountBalancesResponse | null => {
    return balances[address] || null;
  };

  const getTokenBalance = (address: string, contractId: string): number => {
    const balance = balances[address];
    if (!balance) return 0;

    try {
      const tokenBalance = balance.fungible_tokens?.[contractId];
      if (!tokenBalance) return 0;
      return parseFloat(tokenBalance.balance || '0');
    } catch (error) {
      console.error('Error parsing token balance:', error);
      return 0;
    }
  };

  const getStxBalance = (address: string): number => {
    const balance = balances[address];
    if (!balance) return 0;

    try {
      const stxBalance = balance.stx?.balance || '0';
      return parseFloat(stxBalance) / 1000000;
    } catch (error) {
      console.error('Error parsing STX balance:', error);
      return 0;
    }
  };

  const getSubnetBalance = (address: string, contractId: string): number => {
    const balance = balances[address];
    if (!balance) return 0;

    try {
      const subnetTokenBalance = balance.fungible_tokens?.[contractId];
      if (!subnetTokenBalance) return 0;
      return parseFloat(subnetTokenBalance.balance || '0');
    } catch (error) {
      console.error('Error parsing subnet balance:', error);
      return 0;
    }
  };

  const getSubnetTokenBalance = (address: string, subnetContractId: string): number => {
    return getSubnetBalance(address, subnetContractId);
  };

  const getFormattedMainnetBalance = (address: string, contractId: string): string => {
    const rawBalance = getTokenBalance(address, contractId);
    const token = tokens[contractId];
    const decimals = token?.decimals || 6;
    return formatTokenAmount(rawBalance, decimals);
  };

  const getFormattedSubnetBalance = (address: string, contractId: string): string => {
    const rawBalance = getSubnetBalance(address, contractId);
    const token = tokens[contractId];
    const decimals = token?.decimals || 6;
    return formatTokenAmount(rawBalance, decimals);
  };

  const addWalletAddress = (address: string) => {
    if (!isValidStacksAddress(address)) return;
    
    setWatchedAddresses(prev => {
      if (prev.includes(address)) return prev;
      return [...prev, address];
    });
  };

  const removeWalletAddress = (address: string) => {
    setWatchedAddresses(prev => prev.filter(addr => addr !== address));
    setBalances(prev => {
      const newBalances = { ...prev };
      delete newBalances[address];
      return newBalances;
    });
  };

  // Set up polling for balance updates
  useEffect(() => {
    if (watchedAddresses.length > 0) {
      // Clear existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Set up new interval
      intervalRef.current = setInterval(() => {
        refreshBalances();
      }, refreshInterval);
      
      // Initial refresh
      refreshBalances();
    } else {
      // Clear interval if no addresses to watch
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [watchedAddresses.length, refreshInterval]); // Only depend on length to avoid infinite loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      activeRequests.current.clear();
    };
  }, []);

  const contextValue: WalletBalanceContextType = {
    balances,
    isLoading,
    error,
    lastUpdate,
    refreshBalances,
    getBalance,
    getTokenBalance,
    getSubnetBalance,
    getSubnetTokenBalance,
    getStxBalance,
    getFormattedMainnetBalance,
    getFormattedSubnetBalance,
    addWalletAddress,
    removeWalletAddress,
    watchedAddresses,
  };

  return (
    <WalletBalanceContext.Provider value={contextValue}>
      {children}
    </WalletBalanceContext.Provider>
  );
}

export function useWalletBalances(): WalletBalanceContextType {
  const context = useContext(WalletBalanceContext);
  if (!context) {
    throw new Error('useWalletBalances must be used within a WalletBalanceProvider');
  }
  return context;
}

// Simplified convenience hook
export function useBalances(addresses?: string[]) {
  const context = useWalletBalances();
  const addedAddressesRef = useRef(new Set<string>());

  // Add addresses only once when the component mounts or addresses change
  useEffect(() => {
    if (addresses && addresses.length > 0) {
      addresses.forEach(address => {
        if (address && !addedAddressesRef.current.has(address)) {
          context.addWalletAddress(address);
          addedAddressesRef.current.add(address);
        }
      });
    }
  }, [addresses?.join(',')]); // Use join to create stable dependency

  return {
    balances: context.balances,
    isLoading: context.isLoading,
    error: context.error,
    lastUpdate: context.lastUpdate,
    refreshBalances: context.refreshBalances,
    getBalance: context.getBalance,
    getTokenBalance: context.getTokenBalance,
    getSubnetBalance: context.getSubnetBalance,
    getSubnetTokenBalance: context.getSubnetTokenBalance,
    getStxBalance: context.getStxBalance,
    getFormattedMainnetBalance: context.getFormattedMainnetBalance,
    getFormattedSubnetBalance: context.getFormattedSubnetBalance,
  };
}