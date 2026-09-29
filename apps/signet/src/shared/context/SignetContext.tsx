import React, { createContext, useContext, useEffect, type ReactNode } from 'react'
import type { SignetContextType } from './context-types'
import { useWalletSlice } from './slices/walletSlice'
import type { Account, SeedPhrase } from './types'

const SignetContext = createContext<SignetContextType | null>(null)

/** Wallet state for the side panel: lock status, seed phrases, accounts */
export function SignetProvider({ children }: { children: ReactNode }) {
  const walletSlice = useWalletSlice();

  useEffect(() => {
    walletSlice.checkWalletInitialization();
  }, []);

  return (
    <SignetContext.Provider value={walletSlice}>
      {children}
    </SignetContext.Provider>
  );
}

export function useSignetContext() {
  const context = useContext(SignetContext);
  if (!context) {
    throw new Error('useSignetContext must be used within a SignetProvider');
  }
  return context;
}

export type { Account, SeedPhrase };
