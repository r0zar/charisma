'use client';

import React, { createContext, ReactNode, useContext, useState } from 'react';
import { useUser } from '@clerk/nextjs';

import { Bot, BotStats, CreateBotRequest } from '@/schemas/bot.schema';

import { useToast } from './toast-context';

interface BotContextType {
  // Data
  bots: Bot[];
  allBots: Bot[]; // All bots (unfiltered SSR data)
  botStats: BotStats;
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
  initialBots?: Bot[];
}

export function BotProvider({ children, initialBots = [] }: BotProviderProps) {
  const { showSuccess, showError } = useToast();
  const { user, isSignedIn } = useUser();

  const [allBots, setAllBots] = useState<Bot[]>(initialBots);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive filtered bots based on Clerk authentication
  const bots = isSignedIn && user?.id
    ? allBots.filter(bot => bot.clerkUserId === user.id)
    : [];

  // Derive stats from filtered bots
  const botStats: BotStats = {
    totalBots: bots.length,
    activeBots: bots.filter(bot => bot.status === 'active').length,
    pausedBots: bots.filter(bot => bot.status === 'paused').length,
    errorBots: bots.filter(bot => bot.status === 'error').length,
  };

  const createBot = async (request: CreateBotRequest): Promise<Bot> => {
    // Require Clerk authentication for bot creation
    if (!isSignedIn || !user?.id) {
      throw new Error('You must be signed in to create a bot');
    }

    try {
      setLoading(true);

      // Create bot via API using Clerk userId
      const response = await fetch(`/api/v1/bots?userId=${user.id}`, {
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
      setAllBots(prev => [newBot, ...prev]);

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
    // Require Clerk authentication
    if (!isSignedIn || !user?.id) {
      throw new Error('You must be signed in to update bots');
    }

    setLoading(true);
    try {
      const existingBot = bots.find(bot => bot.id === id);
      if (!existingBot) {
        throw new Error('Bot not found');
      }

      // Verify ownership using clerkUserId
      if (existingBot.clerkUserId !== user.id) {
        throw new Error('You can only update bots you own');
      }

      const updatedBot = { ...existingBot, ...updates };

      // Update bot via API using Clerk userId
      const response = await fetch(`/api/v1/bots?userId=${user.id}&botId=${id}`, {
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
      setAllBots(prev => prev.map(bot => bot.id === id ? apiUpdatedBot : bot));

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
    // Require Clerk authentication
    if (!isSignedIn || !user?.id) {
      throw new Error('You must be signed in to delete bots');
    }

    try {
      setLoading(true);

      const existingBot = bots.find(bot => bot.id === id);
      if (!existingBot) {
        throw new Error('Bot not found');
      }

      // Verify ownership using clerkUserId
      if (existingBot.clerkUserId !== user.id) {
        throw new Error('You can only delete bots you own');
      }

      // Delete bot via API using Clerk userId
      const response = await fetch(`/api/v1/bots?userId=${user.id}&botId=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete bot');
      }

      // Update local state
      setAllBots(prev => prev.filter(bot => bot.id !== id));

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
    // Require Clerk authentication
    if (!isSignedIn || !user?.id) {
      throw new Error('You must be signed in to start bots');
    }

    try {
      const existingBot = bots.find(bot => bot.id === id);
      if (!existingBot) {
        throw new Error('Bot not found');
      }

      // Verify ownership using clerkUserId
      console.log('🔍 Bot ownership validation:');
      console.log('  Bot ID:', id);
      console.log('  Bot clerkUserId:', existingBot.clerkUserId);
      console.log('  Current user ID:', user.id);
      console.log('  User IDs match:', existingBot.clerkUserId === user.id);

      if (existingBot.clerkUserId !== user.id) {
        throw new Error(`You can only start bots you own. Bot owner: ${existingBot.clerkUserId}, Your user ID: ${user.id}`);
      }

      // Use state machine for transition
      const userId = user.id;
      const message = `bot_transition_${id}_start`;

      const response = await fetch(`/api/v1/bots/${id}/transitions?userId=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start',
          reason: 'User requested start via bot context'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start bot');
      }

      const result = await response.json();
      const updatedBot = result.bot;

      // Update local state with the returned bot
      setAllBots(prev => prev.map(bot => bot.id === id ? updatedBot : bot));

      showSuccess('Bot started successfully');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start bot';
      showError('Failed to start bot', errorMessage);
      throw new Error(errorMessage);
    }
  };

  const pauseBot = async (id: string): Promise<void> => {
    // Require Clerk authentication
    if (!isSignedIn || !user?.id) {
      throw new Error('You must be signed in to pause bots');
    }

    try {
      const existingBot = bots.find(bot => bot.id === id);
      if (!existingBot) {
        throw new Error('Bot not found');
      }

      // Verify ownership using clerkUserId
      console.log('🔍 Bot ownership validation (pause):');
      console.log('  Bot ID:', id);
      console.log('  Bot clerkUserId:', existingBot.clerkUserId);
      console.log('  Current user ID:', user.id);
      console.log('  User IDs match:', existingBot.clerkUserId === user.id);

      if (existingBot.clerkUserId !== user.id) {
        throw new Error(`You can only pause bots you own. Bot owner: ${existingBot.clerkUserId}, Your user ID: ${user.id}`);
      }

      // Use state machine for transition
      const userId = user.id;
      const message = `bot_transition_${id}_pause`;

      const response = await fetch(`/api/v1/bots/${id}/transitions?userId=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'pause',
          reason: 'User requested pause via bot context'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to pause bot');
      }

      const result = await response.json();
      const updatedBot = result.bot;

      // Update local state with the returned bot
      setAllBots(prev => prev.map(bot => bot.id === id ? updatedBot : bot));

      showSuccess('Bot paused successfully');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pause bot';
      showError('Failed to pause bot', errorMessage);
      throw new Error(errorMessage);
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
    if (!isSignedIn || !user?.id) {
      return;
    }

    setLoading(true);
    try {
      // Fetch fresh data from KV store API using Clerk userId
      const response = await fetch(`/api/v1/bots?userId=${user.id}`);

      if (!response.ok) {
        throw new Error('Failed to refresh data');
      }

      const data = await response.json();

      // Update state with fresh data
      setAllBots(data.list || []);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  const value: BotContextType = {
    bots,
    allBots,
    botStats,
    // marketData removed,
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