'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Bot, BotStats, BotActivity, PerformanceMetrics, MarketData, CreateBotRequest } from '@/types/bot';
import { useNotifications } from './notification-context';
import { useGlobalState } from './global-state-context';
import { API_ENDPOINTS, API_CACHE_KEYS, API_CACHE_TTL } from '@/lib/api-endpoints';

interface BotContextType {
  // Data
  bots: Bot[];
  botStats: BotStats;
  activities: BotActivity[];
  performanceMetrics: PerformanceMetrics;
  marketData: MarketData;
  loading: boolean;
  error: string | null;

  // Actions
  createBot: (request: CreateBotRequest) => Promise<Bot>;
  updateBot: (id: string, updates: Partial<Bot>) => Promise<Bot>;
  deleteBot: (id: string) => Promise<void>;
  startBot: (id: string) => Promise<void>;
  pauseBot: (id: string) => Promise<void>;
  fundBot: (id: string, amount: number) => Promise<void>;
  withdrawFromBot: (id: string, tokenId: string, amount: number) => Promise<void>;

  // Utilities
  getBot: (id: string) => Bot | undefined;
  refreshData: () => Promise<void>;
}

const BotContext = createContext<BotContextType | undefined>(undefined);

export const useBots = () => {
  const context = useContext(BotContext);
  if (!context) {
    throw new Error('useBots must be used within a BotProvider');
  }
  return context;
};

interface BotProviderProps {
  children: ReactNode;
}

export function BotProvider({ children }: BotProviderProps) {
  const { showSuccess, showError } = useNotifications();
  const { appState, loading: globalLoading, error: globalError } = useGlobalState();

  const [bots, setBots] = useState<Bot[]>([]);
  const [botStats, setBotStats] = useState<BotStats>({
    totalBots: 0,
    activeBots: 0,
    pausedBots: 0,
    errorBots: 0,
    totalGas: 0,
    totalValue: 0,
    totalPnL: 0,
    todayPnL: 0
  });
  const [activities, setActivities] = useState<BotActivity[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    dailyPnL: 0,
    weeklyPnL: 0,
    monthlyPnL: 0,
    winRate: 0,
    avgTradeTime: 0,
    totalTrades: 0,
    totalBots: 0,
    activeBots: 0,
    pausedBots: 0,
    errorBots: 0
  });
  const [marketData, setMarketData] = useState<MarketData>({ tokenPrices: {}, priceChanges: {}, marketCap: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize with global state data
  useEffect(() => {
    if (globalLoading) {
      setLoading(true);
      return;
    }

    if (globalError) {
      setError(globalError);
      setLoading(false);
      return;
    }

    if (appState) {
      // Load data from global state
      setBots(appState.bots.list);
      setBotStats(appState.bots.stats);
      setActivities(appState.bots.activities);
      setPerformanceMetrics({
        dailyPnL: appState.bots.stats.totalPnL, // Use daily PnL from stats
        weeklyPnL: appState.bots.stats.totalPnL * 7, // Estimate weekly
        monthlyPnL: appState.bots.stats.totalPnL * 30, // Estimate monthly
        winRate: appState.bots.stats.totalBots > 0 ? (appState.bots.stats.activeBots / appState.bots.stats.totalBots) * 100 : 0,
        avgTradeTime: 45, // Default value
        totalTrades: appState.bots.activities.length
      });
      setMarketData(appState.market.data);
      setError(null);
    }

    setLoading(false);
  }, [appState, globalLoading, globalError]);

  const createBot = async (request: CreateBotRequest): Promise<Bot> => {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      const newBot: Bot = {
        id: `bot-${Date.now()}`,
        name: request.name,
        strategy: request.strategy,
        status: 'setup',
        walletAddress: `SP${Math.random().toString(36).substring(2, 15).toUpperCase()}${Math.random().toString(36).substring(2, 15).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        dailyPnL: 0,
        totalPnL: 0,
        totalVolume: 0,
        successRate: 0,
        maxGasPrice: request.maxGasPrice,
        slippageTolerance: request.slippageTolerance,
        autoRestart: request.autoRestart,
        stxBalance: 0,
        lpTokenBalances: [],
        rewardTokenBalances: [],
        setupProgress: {
          funded: false,
          lpTokensAdded: false,
          activated: false,
          completionPercentage: 0
        },
        recentActivity: []
      };

      setBots(prev => [newBot, ...prev]);
      setBotStats(prev => ({
        ...prev,
        totalBots: prev.totalBots + 1
      }));

      return newBot;
    } catch (err) {
      throw new Error('Failed to create bot');
    } finally {
      setLoading(false);
    }
  };

  const updateBot = async (id: string, updates: Partial<Bot>): Promise<Bot> => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      const existingBot = bots.find(bot => bot.id === id);
      if (!existingBot) {
        throw new Error('Bot not found');
      }

      const updatedBot = { ...existingBot, ...updates };
      setBots(prev => prev.map(bot => bot.id === id ? updatedBot : bot));

      return updatedBot;
    } catch (err) {
      throw new Error('Failed to update bot');
    } finally {
      setLoading(false);
    }
  };

  const deleteBot = async (id: string): Promise<void> => {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      setBots(prev => prev.filter(bot => bot.id !== id));
      setBotStats(prev => ({
        ...prev,
        totalBots: prev.totalBots - 1
      }));

    } catch (err) {
      throw new Error('Failed to delete bot');
    }
  };

  const startBot = async (id: string): Promise<void> => {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      setBots(prev => prev.map(bot =>
        bot.id === id
          ? { ...bot, status: 'active', lastActive: new Date().toISOString() }
          : bot
      ));

      setBotStats(prev => ({
        ...prev,
        activeBots: prev.activeBots + 1
      }));

    } catch (err) {
      throw new Error('Failed to start bot');
    }
  };

  const pauseBot = async (id: string): Promise<void> => {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      setBots(prev => prev.map(bot =>
        bot.id === id
          ? { ...bot, status: 'paused', lastActive: new Date().toISOString() }
          : bot
      ));

      setBotStats(prev => ({
        ...prev,
        activeBots: prev.activeBots - 1
      }));

    } catch (err) {
      throw new Error('Failed to pause bot');
    }
  };

  const fundBot = async (id: string, amount: number): Promise<void> => {
    const bot = bots.find(bot => bot.id === id);
    if (!bot) throw new Error('Bot not found');

    await updateBot(id, {
      stxBalance: bot.stxBalance + amount,
      setupProgress: {
        ...bot.setupProgress,
        funded: true,
        completionPercentage: Math.max(33, bot.setupProgress.completionPercentage)
      }
    });
  };

  const withdrawFromBot = async (id: string, tokenId: string, amount: number): Promise<void> => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const bot = bots.find(bot => bot.id === id);
      if (!bot) throw new Error('Bot not found');

      // Update bot balances (simplified)
      if (tokenId === 'STX') {
        await updateBot(id, { stxBalance: Math.max(0, bot.stxBalance - amount) });
      }
      // Add logic for other tokens as needed

    } catch (err) {
      throw new Error('Failed to withdraw from bot');
    } finally {
      setLoading(false);
    }
  };

  const getBot = (id: string): Bot | undefined => {
    return bots.find(bot => bot.id === id);
  };

  const refreshData = async (): Promise<void> => {
    setLoading(true);
    try {
      // Simulate API refresh
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In a real app, this would fetch fresh data from the API
      // For now, we'll just update the lastActive timestamp
      setBots(prev => prev.map(bot => ({
        ...bot,
        lastActive: new Date().toISOString()
      })));
    } catch (err) {
      setError('Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  const value: BotContextType = {
    bots,
    botStats,
    activities,
    performanceMetrics,
    marketData,
    loading,
    error,
    createBot,
    updateBot,
    deleteBot,
    startBot,
    pauseBot,
    fundBot,
    withdrawFromBot,
    getBot,
    refreshData
  };

  return <BotContext.Provider value={value}>{children}</BotContext.Provider>;
};