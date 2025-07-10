'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Bot, BotStats, BotActivity, PerformanceMetrics, MarketData, CreateBotRequest } from '@/schemas/bot.schema';
import { useNotifications } from './notification-context';
import { useGlobalState } from './global-state-context';
import { useWallet } from './wallet-context';

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
  const { walletState } = useWallet();

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
    daily: [],
    weekly: [],
    monthly: []
  });
  const [marketData, setMarketData] = useState<MarketData>({ tokenPrices: {}, priceChanges: {}, marketCap: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load bot data from KV store when wallet is connected
  useEffect(() => {
    const loadBotData = async () => {
      if (!walletState.connected || !walletState.address) {
        // User not authenticated - show empty state
        setBots([]);
        setBotStats({
          totalBots: 0,
          activeBots: 0,
          pausedBots: 0,
          errorBots: 0,
          totalGas: 0,
          totalValue: 0,
          totalPnL: 0,
          todayPnL: 0
        });
        setActivities([]);
        setPerformanceMetrics({
          daily: [],
          weekly: [],
          monthly: []
        });
        setMarketData({ tokenPrices: {}, priceChanges: {}, marketCap: {} });
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch bot data from KV store API
        const response = await fetch(`/api/v1/bots?userId=${walletState.address}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // If KV store is unavailable, fall back to static data
          if (response.status === 503) {
            console.warn('KV store unavailable, falling back to static data');
            
            if (appState) {
              // Use static data as fallback
              const userBots = appState.bots.list.filter(bot => 
                bot.walletAddress === walletState.address
              );
              const userBotIds = userBots.map(bot => bot.id);
              const userActivities = appState.bots.activities.filter(activity =>
                userBotIds.includes(activity.botId)
              );
              
              setBots(userBots);
              setActivities(userActivities);
              setMarketData(appState.market.data);
              
              // Calculate stats
              const activeBots = userBots.filter(bot => bot.status === 'active').length;
              const pausedBots = userBots.filter(bot => bot.status === 'paused').length;
              const errorBots = userBots.filter(bot => bot.status === 'error').length;
              const totalValue = 0; // Analytics data moved to separate endpoint
              const totalPnL = 0; // Analytics data moved to separate endpoint
              const todayPnL = 0; // Analytics data moved to separate endpoint
              
              setBotStats({
                totalBots: userBots.length,
                activeBots,
                pausedBots,
                errorBots,
                totalGas: 0,
                totalValue,
                totalPnL,
                todayPnL
              });
            }
            
            setLoading(false);
            return;
          }
          
          throw new Error(errorData.message || 'Failed to load bot data');
        }

        const data = await response.json();
        
        // Update state with real KV data
        setBots(data.list || []);
        setActivities(data.activities || []);
        
        // Calculate stats from real data
        const userBots = data.list || [];
        const activeBots = userBots.filter((bot: any) => bot.status === 'active').length;
        const pausedBots = userBots.filter((bot: any) => bot.status === 'paused').length;
        const errorBots = userBots.filter((bot: any) => bot.status === 'error').length;
        const totalValue = userBots.reduce((sum: number, bot: any) => sum + (bot.totalVolume || 0), 0);
        const totalPnL = userBots.reduce((sum: number, bot: any) => sum + (bot.totalPnL || 0), 0);
        const todayPnL = userBots.reduce((sum: number, bot: any) => sum + (bot.dailyPnL || 0), 0);
        
        setBotStats({
          totalBots: userBots.length,
          activeBots,
          pausedBots,
          errorBots,
          totalGas: 0,
          totalValue,
          totalPnL,
          todayPnL
        });
        
        setPerformanceMetrics({
          daily: [],
          weekly: [],
          monthly: []
        });
        
        // Use market data from static state or default
        setMarketData(appState?.market?.data || { tokenPrices: {}, priceChanges: {}, marketCap: {} });
        
      } catch (err) {
        console.error('Error loading bot data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load bot data');
        
        // Fallback to empty state on error
        setBots([]);
        setBotStats({
          totalBots: 0,
          activeBots: 0,
          pausedBots: 0,
          errorBots: 0,
          totalGas: 0,
          totalValue: 0,
          totalPnL: 0,
          todayPnL: 0
        });
        setActivities([]);
        setPerformanceMetrics({
          daily: [],
          weekly: [],
          monthly: []
        });
        setMarketData({ tokenPrices: {}, priceChanges: {}, marketCap: {} });
      } finally {
        setLoading(false);
      }
    };

    loadBotData();
  }, [walletState.connected, walletState.address, appState]);

  const createBot = async (request: CreateBotRequest): Promise<Bot> => {
    // Require wallet connection for bot creation
    if (!walletState.connected || !walletState.address) {
      throw new Error('Wallet must be connected to create a bot');
    }

    try {
      setLoading(true);
      
      // Create bot via API
      const response = await fetch(`/api/v1/bots?userId=${walletState.address}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create bot');
      }

      const data = await response.json();
      const newBot = data.bot;

      // Update local state
      setBots(prev => [newBot, ...prev]);
      setBotStats(prev => ({
        ...prev,
        totalBots: prev.totalBots + 1
      }));

      showSuccess('Bot created successfully');
      return newBot;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create bot';
      showError('Failed to create bot', errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateBot = async (id: string, updates: Partial<Bot>): Promise<Bot> => {
    // Require wallet connection and ownership
    if (!walletState.connected || !walletState.address) {
      throw new Error('Wallet must be connected to update bots');
    }

    setLoading(true);
    try {
      const existingBot = bots.find(bot => bot.id === id);
      if (!existingBot) {
        throw new Error('Bot not found');
      }

      // Verify ownership
      if (existingBot.walletAddress !== walletState.address) {
        throw new Error('You can only update bots you own');
      }

      const updatedBot = { ...existingBot, ...updates };
      
      // Update bot via API
      const response = await fetch(`/api/v1/bots?userId=${walletState.address}&botId=${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedBot),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update bot');
      }

      const data = await response.json();
      const apiUpdatedBot = data.bot;

      // Update local state
      setBots(prev => prev.map(bot => bot.id === id ? apiUpdatedBot : bot));

      return apiUpdatedBot;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update bot';
      showError('Failed to update bot', errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const deleteBot = async (id: string): Promise<void> => {
    // Require wallet connection and ownership
    if (!walletState.connected || !walletState.address) {
      throw new Error('Wallet must be connected to delete bots');
    }

    try {
      setLoading(true);
      
      const existingBot = bots.find(bot => bot.id === id);
      if (!existingBot) {
        throw new Error('Bot not found');
      }

      // Verify ownership
      if (existingBot.walletAddress !== walletState.address) {
        throw new Error('You can only delete bots you own');
      }

      // Delete bot via API
      const response = await fetch(`/api/v1/bots?userId=${walletState.address}&botId=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete bot');
      }

      // Update local state
      setBots(prev => prev.filter(bot => bot.id !== id));
      setBotStats(prev => ({
        ...prev,
        totalBots: prev.totalBots - 1
      }));

      showSuccess('Bot deleted successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete bot';
      showError('Failed to delete bot', errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const startBot = async (id: string): Promise<void> => {
    // Require wallet connection and ownership
    if (!walletState.connected || !walletState.address) {
      throw new Error('Wallet must be connected to start bots');
    }

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const existingBot = bots.find(bot => bot.id === id);
      if (!existingBot) {
        throw new Error('Bot not found');
      }

      // Verify ownership
      if (existingBot.walletAddress !== walletState.address) {
        throw new Error('You can only start bots you own');
      }

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
    // Require wallet connection and ownership
    if (!walletState.connected || !walletState.address) {
      throw new Error('Wallet must be connected to pause bots');
    }

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const existingBot = bots.find(bot => bot.id === id);
      if (!existingBot) {
        throw new Error('Bot not found');
      }

      // Verify ownership
      if (existingBot.walletAddress !== walletState.address) {
        throw new Error('You can only pause bots you own');
      }

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

    // Balance updates now handled through analytics system
    throw new Error('Balance updates not supported - use analytics endpoints');
  };

  const withdrawFromBot = async (id: string, tokenId: string, amount: number): Promise<void> => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const bot = bots.find(bot => bot.id === id);
      if (!bot) throw new Error('Bot not found');

      // Balance updates now handled through analytics system
      throw new Error('Balance updates not supported - use analytics endpoints');

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
    if (!walletState.connected || !walletState.address) {
      return;
    }

    setLoading(true);
    try {
      // Fetch fresh data from KV store API
      const response = await fetch(`/api/v1/bots?userId=${walletState.address}`);
      
      if (!response.ok) {
        throw new Error('Failed to refresh data');
      }

      const data = await response.json();
      
      // Update state with fresh data
      setBots(data.list || []);
      setActivities(data.activities || []);
      
      // Recalculate stats
      const userBots = data.list || [];
      const activeBots = userBots.filter((bot: any) => bot.status === 'active').length;
      const pausedBots = userBots.filter((bot: any) => bot.status === 'paused').length;
      const errorBots = userBots.filter((bot: any) => bot.status === 'error').length;
      const totalValue = userBots.reduce((sum: number, bot: any) => sum + (bot.totalVolume || 0), 0);
      const totalPnL = userBots.reduce((sum: number, bot: any) => sum + (bot.totalPnL || 0), 0);
      const todayPnL = userBots.reduce((sum: number, bot: any) => sum + (bot.dailyPnL || 0), 0);
      
      setBotStats({
        totalBots: userBots.length,
        activeBots,
        pausedBots,
        errorBots,
        totalGas: 0,
        totalValue,
        totalPnL,
        todayPnL
      });
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
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