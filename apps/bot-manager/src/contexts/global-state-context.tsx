'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AppState } from '@/schemas/app-state.schema';
import { validateAppState } from '@/lib/state';
import { useWallet } from '@/contexts/wallet-context';

interface GlobalStateContextType {
  // Global state data
  appState: AppState | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  refreshState: () => Promise<void>;
  updateState: (newState: AppState) => void;
  
  // Utilities
  isStateLoaded: boolean;
}

const GlobalStateContext = createContext<GlobalStateContextType | undefined>(undefined);

export const useGlobalState = () => {
  const context = useContext(GlobalStateContext);
  if (!context) {
    throw new Error('useGlobalState must be used within a GlobalStateProvider');
  }
  return context;
};

interface GlobalStateProviderProps {
  children: ReactNode;
  initialData?: AppState;
}

export function GlobalStateProvider({ children, initialData }: GlobalStateProviderProps) {
  const { walletState } = useWallet();
  const [appState, setAppState] = useState<AppState | null>(initialData || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshState = async (): Promise<void> => {
    // For now, refreshing is not implemented client-side
    // This would typically require an API endpoint
    console.warn('Client-side refresh not implemented');
  };

  const updateState = (newState: AppState): void => {
    // Authentication guard - only allow state updates when wallet is connected
    if (!walletState.connected) {
      setError('Wallet connection required to update state');
      console.warn('Attempted state update without wallet connection');
      return;
    }

    // Validate the new state before setting it
    const validation = validateAppState(newState);
    if (validation.success && validation.data) {
      setAppState(validation.data);
      setError(null);
    } else {
      setError(validation.error || 'Invalid state data');
      console.error('Invalid app state:', validation.validationErrors);
    }
  };

  const value: GlobalStateContextType = {
    appState,
    loading,
    error,
    refreshState,
    updateState,
    isStateLoaded: appState !== null
  };

  return (
    <GlobalStateContext.Provider value={value}>
      {children}
    </GlobalStateContext.Provider>
  );
}