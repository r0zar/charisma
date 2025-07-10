'use client';

import { useState, useEffect } from 'react';
import { Bot } from '@/schemas/bot.schema';

interface PublicBotStats {
  totalBots: number;
  activeBots: number;
  pausedBots: number;
  errorBots: number;
  totalUsers: number;
}

interface UsePublicBotsResult {
  bots: Bot[];
  stats: PublicBotStats;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

export function usePublicBots(): UsePublicBotsResult {
  const [bots, setBots] = useState<Bot[]>([]);
  const [stats, setStats] = useState<PublicBotStats>({
    totalBots: 0,
    activeBots: 0,
    pausedBots: 0,
    errorBots: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPublicBots = async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/v1/bots/public');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to load public bot data');
      }

      const data = await response.json();
      
      // Ensure data.list is a valid array and filter out any invalid bots
      const validBots = (data.list || []).filter((bot: any) => 
        bot && 
        typeof bot.id === 'string' && 
        typeof bot.name === 'string' && 
        typeof bot.strategy === 'string' &&
        typeof bot.status === 'string' &&
        typeof bot.ownerId === 'string'
      );
      
      setBots(validBots);
      setStats(data.stats || {
        totalBots: 0,
        activeBots: 0,
        pausedBots: 0,
        errorBots: 0,
        totalUsers: 0,
      });

      console.log(`[usePublicBots] Loaded ${data.list?.length || 0} public bots from ${data.stats?.totalUsers || 0} users`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load public bots';
      setError(errorMessage);
      console.error('[usePublicBots] Error loading public bots:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async (): Promise<void> => {
    setLoading(true);
    await fetchPublicBots();
  };

  useEffect(() => {
    fetchPublicBots();
  }, []);

  return {
    bots,
    stats,
    loading,
    error,
    refreshData,
  };
}