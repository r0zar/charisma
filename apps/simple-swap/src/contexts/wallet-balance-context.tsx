'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { AccountBalancesResponse } from '@repo/polyglot';
import { getBalancesAction } from '@/app/actions';
// import { balanceClient } from '@repo/tokens'; // Avoiding import to prevent SSR hang
import { formatTokenAmount } from '@/lib/swap-utils';
import { useTokenMetadata } from './token-metadata-context';
import { useSubnetTokens } from './subnet-tokens-context';
import type { BulkBalanceResponse } from '@repo/tokens';
// Note: getAddressBalances removed - using balance service or original method

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
  const [useBalanceService, setUseBalanceService] = useState(true); // Default to using the new balance service
  const [tryDataClient, setTryDataClient] = useState(true); // Simple flag to try data client

  const { tokens, getTokenDecimals } = useTokenMetadata();
  const { getSubnetContractId } = useSubnetTokens();

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
      // Skip data client - no longer available

      // Use balance service if enabled, otherwise fall back to original method
      if (useBalanceService) {
        console.log('[WalletBalanceContext] Using balance service for refresh');

        const response = await getBalancesAction(addressesToUpdate, undefined, true); // Include zero balances

        if (response.success && response.balances) {
          const newBalances = { ...balances };

          // Convert service balance data to AccountBalancesResponse format
          Object.entries(response.balances).forEach(([address, balanceResponse]) => {
            if (balanceResponse) {
              newBalances[address] = {
                stx: {
                  balance: balanceResponse.stxBalance,
                  total_sent: balanceResponse.metadata.stxTotalSent,
                  total_received: balanceResponse.metadata.stxTotalReceived,
                  total_fees_sent: '0',
                  total_miner_rewards_received: '0',
                  lock_tx_id: '',
                  locked: balanceResponse.metadata.stxLocked,
                  lock_height: 0,
                  burnchain_lock_height: 0,
                  burnchain_unlock_height: 0
                },
                fungible_tokens: Object.fromEntries(
                  Object.entries(balanceResponse.fungibleTokens).map(([contractId, token]) => [
                    contractId,
                    {
                      balance: token.balance,
                      total_sent: '0',
                      total_received: token.balance
                    }
                  ])
                ),
                non_fungible_tokens: balanceResponse.nonFungibleTokens
              };
            }
          });

          setBalances(newBalances);
          setLastUpdate(Date.now());
          console.log(`[WalletBalanceContext] Successfully updated ${Object.keys(response.balances).length} addresses using balance service`);
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
              // Use direct API call instead of balance client to avoid SSR hang
              const cacheBuster = Date.now();
              const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : '');
              const response = await fetch(`${baseUrl}/api/v1/balances/${address}?includeZero=true&_t=${cacheBuster}`, {
                headers: {
                  'Accept': 'application/json',
                  'Cache-Control': 'no-cache'
                },
                signal: AbortSignal.timeout(15000)
              });
              const balanceResponse = response.ok ? await response.json() : null;
              if (!balanceResponse) {
                return null;
              }

              // Convert balance client response to AccountBalancesResponse format
              const balanceData: AccountBalancesResponse = {
                stx: {
                  balance: balanceResponse.stxBalance,
                  total_sent: balanceResponse.metadata.stxTotalSent,
                  total_received: balanceResponse.metadata.stxTotalReceived,
                  total_fees_sent: '0',
                  total_miner_rewards_received: '0',
                  lock_tx_id: '',
                  locked: balanceResponse.metadata.stxLocked,
                  lock_height: 0,
                  burnchain_lock_height: 0,
                  burnchain_unlock_height: 0
                },
                fungible_tokens: Object.fromEntries(
                  Object.entries(balanceResponse.fungibleTokens).map(([contractId, token]) => [
                    contractId,
                    {
                      balance: token.balance,
                      total_sent: '0',
                      total_received: token.balance
                    }
                  ])
                ),
                non_fungible_tokens: balanceResponse.nonFungibleTokens
              };

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
    if (!balance) {
      return 0;
    }

    try {
      const tokenBalance = balance.fungible_tokens?.[contractId];
      if (!tokenBalance) {
        return 0;
      }
      const result = parseFloat(tokenBalance.balance || '0');

      return result;
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
    const formatted = formatTokenAmount(rawBalance, decimals);

    return formatted;
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

      // Fallback: format balance even without token metadata - use correct decimals from metadata context
      const rawBalance = getTokenBalance(address, contractId);

      // Look for corresponding subnet token using the subnet tokens API
      const subnetContractId = getSubnetContractId(contractId);
      const rawSubnetBalance = subnetContractId ? getTokenBalance(address, subnetContractId) : 0;

      // Get proper decimals from metadata context
      const mainnetDecimals = getTokenDecimals(contractId) || 6;
      const subnetDecimals = subnetContractId ? (getTokenDecimals(subnetContractId) || 6) : 6;

      // Extra debug for USDh tokens
      if (contractId.includes('usdh-token')) {
        console.log('[WalletBalanceContext] USDh fallback formatting:', {
          contractId,
          mainnetBalance: rawBalance,
          mainnetDecimals,
          subnetContractId: subnetContractId,
          subnetBalance: rawSubnetBalance,
          subnetDecimals
        });
      }

      if (rawBalance > 0 || rawSubnetBalance > 0) {
        const mainnetFormatted = rawBalance > 0 ? formatTokenAmount(rawBalance, mainnetDecimals) : "0";
        const subnetFormatted = rawSubnetBalance > 0 ? formatTokenAmount(rawSubnetBalance, subnetDecimals) : "0";
        const hasSubnet = rawSubnetBalance > 0;
        return { mainnet: mainnetFormatted, subnet: subnetFormatted, hasSubnet };
      }

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

    // Debug logging for Charisma token
    if (contractId.includes('charisma-token')) {
      console.log('[WalletBalanceContext] Final Charisma result:', {
        contractId,
        tokenType: token.type,
        mainnetBalance,
        subnetBalance,
        hasSubnet
      });
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