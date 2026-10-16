'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { connect, disconnect, getLocalStorage, isConnected } from '@stacks/connect';

interface Wallet { address: string | null; connect: () => Promise<void>; disconnect: () => void }
const WalletContext = createContext<Wallet>({ address: null, connect: async () => {}, disconnect: () => {} });

const stxAddress = () => getLocalStorage()?.addresses?.stx?.find(a => a.address.startsWith('SP'))?.address ?? null;

/** The connected Stacks wallet, remembered between visits by @stacks/connect */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => { if (isConnected()) setAddress(stxAddress()); }, []);

  const value: Wallet = {
    address,
    connect: async () => { await connect(); setAddress(stxAddress()); },
    disconnect: () => { disconnect(); setAddress(null); },
  };
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export const useWallet = () => useContext(WalletContext);
