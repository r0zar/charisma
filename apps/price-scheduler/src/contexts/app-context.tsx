"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface AppState {
  isLoading: boolean;
  user: User | null;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface AppContextType {
  state: AppState;
  setLoading: (loading: boolean) => void;
  setUser: (user: User | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, setState] = useState<AppState>({
    isLoading: false,
    user: null,
  });

  const setLoading = (isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  };

  const setUser = (user: User | null) => {
    setState(prev => ({ ...prev, user }));
  };

  const value: AppContextType = {
    state,
    setLoading,
    setUser,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}