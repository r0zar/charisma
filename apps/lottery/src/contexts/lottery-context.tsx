"use client";

import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { LotteryConfig } from "@/types/lottery";

interface LotteryContextType {
  config: LotteryConfig | null;
  isLoading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
}

const LotteryContext = createContext<LotteryContextType | undefined>(undefined);

interface LotteryProviderProps {
  children: ReactNode;
}

export function LotteryProvider({ children }: LotteryProviderProps) {
  const [config, setConfig] = useState<LotteryConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/v1/lottery/config');
      const result = await response.json();
      
      if (response.ok && result.success) {
        setConfig(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch lottery config');
      }
    } catch (err) {
      console.error('Failed to fetch lottery config:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshConfig = async () => {
    await fetchConfig();
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const value: LotteryContextType = {
    config,
    isLoading,
    error,
    refreshConfig,
  };

  return <LotteryContext.Provider value={value}>{children}</LotteryContext.Provider>;
}

export function useLottery() {
  const context = useContext(LotteryContext);
  if (context === undefined) {
    throw new Error("useLottery must be used within a LotteryProvider");
  }
  return context;
}