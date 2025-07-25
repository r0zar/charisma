'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { AccountBalancesResponse } from '@repo/polyglot';
import { getAccountBalancesWithSubnet, getBalancesAction, getAddressBalancesAction } from '@/app/actions';
import { formatTokenAmount } from '@/lib/swap-utils';
import { useTokenMetadata } from './token-metadata-context';
import type { BulkBalanceResponse } from '@/lib/cached-balance-client';
import { getAddressBalances } from '@repo/tokens';

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
  // New functions for automatic subnet/mainnet lookup
  getFormattedBalanceWithSubnet: (address: string, contractId: string) => { mainnet: string; subnet: string; hasSubnet: boolean };
  addWalletAddress: (address: string) => void;
  removeWalletAddress: (address: string) => void;
  watchedAddresses: string[];
}

const WalletBalanceContext = createContext<WalletBalanceContextType | undefined>(undefined);

interface WalletBalanceProviderProps {
  children: ReactNode;
  refreshInterval?: number;
  initialBalances?: Record<string, AccountBalancesResponse>;
  initialServiceBalances?: BulkBalanceResponse;
}

export function WalletBalanceProvider({ 
  children, 
  refreshInterval = 60000,
  initialBalances,
  initialServiceBalances
}: WalletBalanceProviderProps) {
  const [balances, setBalances] = useState<Record<string, AccountBalancesResponse>>(initialBalances || {});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [watchedAddresses, setWatchedAddresses] = useState<string[]>([]);
  const [useBalanceService, setUseBalanceService] = useState(!!initialServiceBalances);
  const [tryDataClient, setTryDataClient] = useState(true); // Simple flag to try data client
  
  const { tokens } = useTokenMetadata();
  
  // Use refs to track active requests and prevent duplicates
  const activeRequests = useRef(new Set<string>());
  const intervalRef = useRef<NodeJS.Timeout | undefined>();

  const isValidStacksAddress = (address: string): boolean => {
    return Boolean(address && (address.startsWith('SP') || address.startsWith('ST')));
  };

  // Helper function to convert balance service data to AccountBalancesResponse format
  const convertServiceBalancesToAccountResponse = (
    address: string,
    serviceBalances: Record<string, string>
  ): AccountBalancesResponse => {
    const fungible_tokens: Record<string, any> = {};
    
    Object.entries(serviceBalances).forEach(([contractId, balance]) => {
      if (balance !== '0') {
        fungible_tokens[contractId] = {
          balance: balance,
          total_sent: '0',
          total_received: balance,
        };
      }
    });

    return {
      stx: {
        balance: serviceBalances['STX'] || '0',
        total_sent: '0',
        total_received: serviceBalances['STX'] || '0',
        total_fees_sent: '0',
        total_miner_rewards_received: '0',
        lock_tx_id: '',
        locked: '0',
        lock_height: 0,
        burnchain_lock_height: 0,
        burnchain_unlock_height: 0
      },
      fungible_tokens,
      non_fungible_tokens: {}
    };
  };

  const refreshBalances = async (addresses?: string[]) => {
    const addressesToUpdate = addresses || watchedAddresses;
    if (addressesToUpdate.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      // Try data client first if enabled (simple, clean integration)
      if (tryDataClient) {
        console.log('[WalletBalanceContext] Trying data client for balance refresh');
        
        try {
          const dataClientBalances = await getAddressBalances(addressesToUpdate, { timeout: 8000, retries: 1 });
          
          // Convert to expected format (simple conversion)
          const convertedBalances: Record<string, AccountBalancesResponse> = {};
          Object.entries(dataClientBalances).forEach(([address, balanceData]) => {
            const fungible_tokens: Record<string, any> = {};
            Object.entries(balanceData.fungibleTokens).forEach(([contractId, tokenData]) => {
              fungible_tokens[contractId] = {
                balance: tokenData.balance,
                total_sent: '0',
                total_received: tokenData.balance,
              };
            });

            convertedBalances[address] = {
              stx: {
                balance: balanceData.stxBalance,
                total_sent: balanceData.metadata.stxTotalSent,
                total_received: balanceData.metadata.stxTotalReceived,
                lock_tx_id: '',
                locked: balanceData.metadata.stxLocked,
                lock_height: 0,
                burnchain_lock_height: 0,
                burnchain_unlock_height: 0
              },
              fungible_tokens,
              non_fungible_tokens: {}
            };
          });
          
          setBalances(prevBalances => ({ ...prevBalances, ...convertedBalances }));
          setLastUpdate(Date.now());
          console.log(`[WalletBalanceContext] ✓ Data client success: ${Object.keys(convertedBalances).length} addresses`);
          return; // Success - exit early
        } catch (dataClientError) {
          console.warn('[WalletBalanceContext] Data client failed, falling back:', dataClientError);
          setTryDataClient(false); // Disable for this session
        }
      }
      
      // Use balance service if enabled, otherwise fall back to original method
      if (useBalanceService) {
        console.log('[WalletBalanceContext] Using balance service for refresh');
        
        const response = await getBalancesAction(addressesToUpdate, undefined, false);
        
        if (response.success && response.data) {
          const newBalances = { ...balances };
          
          // Convert service balance data to AccountBalancesResponse format
          Object.entries(response.data).forEach(([address, serviceBalances]) => {
            newBalances[address] = convertServiceBalancesToAccountResponse(address, serviceBalances);
          });
          
          setBalances(newBalances);
          setLastUpdate(Date.now());
          console.log(`[WalletBalanceContext] Successfully updated ${Object.keys(response.data).length} addresses using balance service`);
        } else {
          console.warn('[WalletBalanceContext] Balance service failed, falling back to original method');
          setUseBalanceService(false);
          // Fall through to original method
        }
      }
      
      // Original method (fallback or when balance service is disabled)
      if (!useBalanceService) {
        console.log('[WalletBalanceContext] Using original balance fetching method');
        
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
      }
    } catch (err) {
      console.error('Failed to refresh balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh balances');
      
      // If balance service failed, try falling back to original method
      if (useBalanceService) {
        console.log('[WalletBalanceContext] Balance service error, disabling for this session');
        setUseBalanceService(false);
      }
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

  const getFormattedBalanceWithSubnet = (address: string, contractId: string): { mainnet: string; subnet: string; hasSubnet: boolean } => {
    const token = tokens[contractId];
    if (!token) {
      return { mainnet: "0", subnet: "0", hasSubnet: false };
    }

    let mainnetBalance: string;
    let subnetBalance: string;
    let hasSubnet: boolean;

    if (token.type === 'SUBNET' && token.base) {
      // This is a subnet token - get mainnet balance from base, subnet balance from this token
      mainnetBalance = getFormattedMainnetBalance(address, token.base);
      subnetBalance = getFormattedSubnetBalance(address, contractId);
      hasSubnet = getSubnetBalance(address, contractId) > 0;
    } else {
      // This is a mainnet token - get mainnet balance from this token, look for corresponding subnet token
      mainnetBalance = getFormattedMainnetBalance(address, contractId);
      
      // Find corresponding subnet token
      const subnetToken = Object.values(tokens).find(t => t.type === 'SUBNET' && t.base === contractId);
      if (subnetToken) {
        subnetBalance = getFormattedSubnetBalance(address, subnetToken.contractId);
        hasSubnet = getSubnetBalance(address, subnetToken.contractId) > 0;
      } else {
        subnetBalance = "0";
        hasSubnet = false;
      }
    }

    return { mainnet: mainnetBalance, subnet: subnetBalance, hasSubnet };
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

  // Process initial service balance data
  useEffect(() => {
    if (initialServiceBalances?.success && initialServiceBalances.data) {
      console.log('[WalletBalanceContext] Processing initial service balance data');
      
      const processedBalances: Record<string, AccountBalancesResponse> = {};
      
      Object.entries(initialServiceBalances.data).forEach(([address, serviceBalances]) => {
        processedBalances[address] = convertServiceBalancesToAccountResponse(address, serviceBalances);
        
        // Auto-add the address to watched list
        setWatchedAddresses(prev => {
          if (!prev.includes(address)) {
            return [...prev, address];
          }
          return prev;
        });
      });
      
      setBalances(prev => ({ ...prev, ...processedBalances }));
      setLastUpdate(Date.now());
      
      console.log(`[WalletBalanceContext] Processed ${Object.keys(processedBalances).length} addresses from initial service data`);
    }
  }, [initialServiceBalances]);


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
    getFormattedBalanceWithSubnet,
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
    getFormattedBalanceWithSubnet: context.getFormattedBalanceWithSubnet,
  };
}