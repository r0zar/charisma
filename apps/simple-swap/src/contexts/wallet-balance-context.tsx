'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { AccountBalancesResponse } from '@repo/polyglot';
import { getBalances, watchBalances, type BalanceSheet } from 'blaze-sdk';
import { formatTokenAmount } from '@/lib/swap-utils';
import { useTokenMetadata } from './token-metadata-context';
import { useSubnetTokens } from './subnet-tokens-context';
import { isListedSubnet, pairOf } from '@/lib/subnet-pairs';

/**
 * Balances everywhere in Swap are instant balances: each watched wallet keeps one live stream open to the balance
 * service (blaze-sdk watchBalances), so a number moves the moment something happens, with no polling. Each token's
 * number is its balance: settled on the chain, plus what's on its way. What signed orders set aside stays in it,
 * since signing locks nothing; getSubnetFree leaves it out, for planning new orders. The sheets explain the numbers.
 */

/** A sheet in the shape Swap's balance helpers read: each token's balance */
function toAccountBalances(sheet: BalanceSheet): AccountBalancesResponse {
  const ready = (token: string) => sheet.tokens[token]?.ready ?? '0';
  const fungible_tokens: AccountBalancesResponse['fungible_tokens'] = {};
  for (const [token, part] of Object.entries(sheet.tokens)) {
    // A token whose chain balance couldn't be read is left out; the provider reports it in `error`
    if (token === '.stx' || part.ready === null) continue;
    fungible_tokens[token] = { balance: part.ready, total_sent: '0', total_received: '0' };
  }
  return { stx: { balance: ready('.stx'), total_sent: '0', total_received: '0' }, fungible_tokens, non_fungible_tokens: {} };
}

/** Tokens a sheet couldn't read, as one message */
const unreadable = (sheet: BalanceSheet) => {
  const failed = Object.entries(sheet.tokens).filter(([, t]) => t.error).map(([token]) => token.split('.')[1] ?? token);
  return failed.length ? `Couldn't read ${failed.join(', ')} from the chain; those balances are missing until it can` : null;
};

interface WalletBalanceContextType {
  balances: Record<string, AccountBalancesResponse>;
  /** The live balance sheet behind each watched wallet's numbers */
  sheets: Record<string, BalanceSheet>;
  /** Hears every new sheet for a wallet as it arrives; returns the way to stop */
  onSheet: (address: string, listener: (sheet: BalanceSheet) => void) => () => void;
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
  refreshBalances: (addresses?: string[]) => Promise<void>;
  getBalance: (address: string) => AccountBalancesResponse | null;
  getTokenBalance: (address: string, contractId: string) => number;
  /** A subnet balance; for CHA, WELSH and sBTC, Blaze v1 and v2 together (one balance for the user) */
  getSubnetBalance: (address: string, contractId: string) => number;
  /** One subnet contract's own balance, never combined: for picking which subnet pays */
  getSubnetBalanceExact: (address: string, contractId: string) => number;
  getSubnetTokenBalance: (address: string, subnetContractId: string) => number;
  /** A subnet balance less what signed orders and bets have set aside from it (combined like getSubnetBalance): what a new order can count on */
  getSubnetFree: (address: string, contractId: string) => number;
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
}

export function WalletBalanceProvider({ children }: WalletBalanceProviderProps) {
  const [sheets, setSheets] = useState<Record<string, BalanceSheet>>({});
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [watchedAddresses, setWatchedAddresses] = useState<string[]>([]);

  const balances: Record<string, AccountBalancesResponse> = Object.fromEntries(
    Object.entries(sheets).map(([address, sheet]) => [address, toAccountBalances(sheet)])
  );
  const isLoading = watchedAddresses.some(address => !sheets[address]);

  const { tokens, getTokenDecimals } = useTokenMetadata();
  const { getSubnetContractId } = useSubnetTokens();

  const isValidStacksAddress = (address: string): boolean => {
    return Boolean(address && (address.startsWith('SP') || address.startsWith('ST')));
  };

  const listeners = useRef(new Map<string, Set<(sheet: BalanceSheet) => void>>());

  const receive = (address: string, sheet: BalanceSheet) => {
    setSheets(prev => ({ ...prev, [address]: sheet }));
    setLastUpdate(Date.now());
    setError(unreadable(sheet));
    for (const listener of listeners.current.get(address) ?? []) listener(sheet);
  };

  const onSheet = (address: string, listener: (sheet: BalanceSheet) => void) => {
    const set = listeners.current.get(address) ?? listeners.current.set(address, new Set()).get(address)!;
    set.add(listener);
    return () => { set.delete(listener); };
  };

  /** Reads the sheets once more; live streams already keep them current, so this is rarely needed */
  const refreshBalances = async (addresses?: string[]) => {
    const targets = (addresses || watchedAddresses).filter(isValidStacksAddress);
    const results = await Promise.allSettled(targets.map(async address => receive(address, await getBalances(address))));
    const failures = results.flatMap(r => (r.status === 'rejected' ? [r.reason instanceof Error ? r.reason.message : String(r.reason)] : []));
    if (failures.length) setError(failures.join('; '));
  };

  const getBalance = (address: string): AccountBalancesResponse | null => {
    return balances[address] || null;
  };

  const getTokenBalance = (address: string, contractId: string): number => {
    const balance = balances[address];
    if (!balance) {
      return 0;
    }

    // STX is native, not a fungible token, so it lives in its own field (raw micro-STX like other raw balances)
    if (['stx', '.stx'].includes(contractId.toLowerCase())) {
      return parseFloat(balance.stx?.balance || '0');
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

  const getSubnetBalanceExact = (address: string, contractId: string): number => {
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

  // CHA, WELSH and sBTC sit in two subnets during the Blaze v2 migration; everywhere a balance is shown, it's one number
  const getSubnetBalance = (address: string, contractId: string): number => {
    const pair = pairOf(contractId);
    return pair
      ? getSubnetBalanceExact(address, pair.v1) + getSubnetBalanceExact(address, pair.v2)
      : getSubnetBalanceExact(address, contractId);
  };

  const getSubnetFree = (address: string, contractId: string): number => {
    const pair = pairOf(contractId);
    const free = (id: string) => getSubnetBalanceExact(address, id) + Number(sheets[address]?.tokens[id]?.held ?? '0');
    return pair ? free(pair.v1) + free(pair.v2) : free(contractId);
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
    // Special handling for STX
    if (['stx', '.stx'].includes(contractId.toLowerCase())) {
      const stxBalance = getStxBalance(address);
      const formatted = stxBalance > 0 ? stxBalance.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6
      }) : "0";
      return { mainnet: formatted, subnet: "0", hasSubnet: false };
    }

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

      // Find corresponding subnet token (a v1/v2 pair: the v1 entry, whose balance includes v2)
      const subnets = Object.values(tokens).filter(t => t.type === 'SUBNET' && t.base === contractId);
      const subnetToken = subnets.find(t => pairOf(t.contractId)?.v1 === t.contractId) ?? subnets.find(t => isListedSubnet(t.contractId));
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
    setSheets(prev => {
      const { [address]: _gone, ...rest } = prev;
      return rest;
    });
  };

  // One live stream per watched wallet: the balance service pushes each change as it happens
  useEffect(() => {
    const stops = watchedAddresses.map(address =>
      watchBalances(address, sheet => receive(address, sheet), { onProblem: problem => setError(problem.message) })
    );
    return () => stops.forEach(stop => stop());
  }, [watchedAddresses.join(',')]);

  const contextValue: WalletBalanceContextType = {
    balances,
    sheets,
    onSheet,
    isLoading,
    error,
    lastUpdate,
    refreshBalances,
    getBalance,
    getTokenBalance,
    getSubnetBalance,
    getSubnetBalanceExact,
    getSubnetFree,
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
    getSubnetBalanceExact: context.getSubnetBalanceExact,
    getSubnetFree: context.getSubnetFree,
    getSubnetTokenBalance: context.getSubnetTokenBalance,
    getStxBalance: context.getStxBalance,
    getFormattedMainnetBalance: context.getFormattedMainnetBalance,
    getFormattedSubnetBalance: context.getFormattedSubnetBalance,
    getFormattedBalanceWithSubnet: context.getFormattedBalanceWithSubnet,
  };
}