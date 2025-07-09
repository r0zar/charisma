'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState } from '@/types/app-state';
import { loadAppStateWithFallback } from '@/lib/state-loader';

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
}

export function GlobalStateProvider({ children }: GlobalStateProviderProps) {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadState = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load state from JSON file with fallback to default
      const state = await loadAppStateWithFallback('/data/app-state.json');
      setAppState(state);
      
      console.log('Global app state loaded:', {
        version: state.metadata.version,
        botCount: state.bots.list.length,
        activitiesCount: state.bots.activities.length,
        poolsCount: state.market.pools.length,
        profile: state.metadata.profile
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load app state';
      setError(errorMessage);
      console.error('Failed to load global app state:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load initial state
  useEffect(() => {
    loadState();
  }, []);

  const refreshState = async (): Promise<void> => {
    await loadState();
  };

  const updateState = (newState: AppState): void => {
    setAppState(newState);
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