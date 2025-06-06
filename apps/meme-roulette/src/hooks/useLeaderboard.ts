'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UserStats, LeaderboardEntry } from '@/lib/leaderboard-kv';

// ========================================
// TYPES
// ========================================

export interface LeaderboardData {
    entries: LeaderboardEntry[];
    totalUsers: number;
    lastUpdated: number;
    type: 'total_cha' | 'total_votes' | 'current_round';
    limit: number;
}

export interface UserProfile {
    userId: string;
    stats: UserStats;
    totalCHARank: number | null;
    totalVotesRank: number | null;
    currentRoundRank: number | null;
}

interface UseLeaderboardOptions {
    type?: 'total_cha' | 'total_votes' | 'current_round';
    limit?: number;
    refreshInterval?: number; // Auto-refresh interval in ms
    enabled?: boolean; // Whether to fetch data
}

export interface AchievementDefinition {
    id: string;
    name: string;
    description: string;
    type: 'milestone' | 'streak' | 'special' | 'earnings' | 'social';
    threshold?: number;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface UserAchievement {
    achievementId: string;
    unlockedAt: number;
    roundId?: string;
    value?: number;
}

export interface AchievementsData {
    achievements: AchievementDefinition[];
    totalCount: number;
}

export interface UserAchievementsData {
    achievements: UserAchievement[];
    definitions: AchievementDefinition[];
    unlockedCount: number;
    totalCount: number;
}

// ========================================
// MAIN HOOK
// ========================================

export function useLeaderboard(options: UseLeaderboardOptions = {}) {
    const {
        type = 'total_cha',
        limit = 50,
        refreshInterval = 30000, // 30 seconds default
        enabled = true
    } = options;

    const [data, setData] = useState<LeaderboardData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchLeaderboard = useCallback(async () => {
        if (!enabled) return;

        try {
            setIsLoading(true);
            setError(null);

            // Cancel previous request if ongoing
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new abort controller
            abortControllerRef.current = new AbortController();

            const url = new URL('/api/leaderboard', window.location.origin);
            url.searchParams.set('action', 'leaderboard');
            url.searchParams.set('type', type);
            url.searchParams.set('limit', limit.toString());

            const response = await fetch(url.toString(), {
                signal: abortControllerRef.current.signal,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch leaderboard');
            }

            setData(result.data);
        } catch (err) {
            // Don't set error for aborted requests
            if (err instanceof Error && err.name === 'AbortError') {
                return;
            }

            console.error('Failed to fetch leaderboard:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard');
        } finally {
            setIsLoading(false);
        }
    }, [enabled, type, limit]);

    // Initial fetch and setup interval
    useEffect(() => {
        if (!enabled) return;

        fetchLeaderboard();

        // Set up auto-refresh interval
        if (refreshInterval > 0) {
            intervalRef.current = setInterval(fetchLeaderboard, refreshInterval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchLeaderboard, refreshInterval, enabled]);

    const refresh = useCallback(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    return {
        data,
        isLoading,
        error,
        refresh
    };
}

// ========================================
// USER PROFILE HOOK
// ========================================

export function useUserProfile(userId: string | null, options: { enabled?: boolean; refreshInterval?: number } = {}) {
    const { enabled = true, refreshInterval = 60000 } = options; // 1 minute default

    const [data, setData] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchUserProfile = useCallback(async () => {
        if (!enabled || !userId) return;

        try {
            setIsLoading(true);
            setError(null);

            // Cancel previous request if ongoing
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new abort controller
            abortControllerRef.current = new AbortController();

            const url = new URL('/api/leaderboard', window.location.origin);
            url.searchParams.set('action', 'user_profile');
            url.searchParams.set('userId', userId);

            const response = await fetch(url.toString(), {
                signal: abortControllerRef.current.signal,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch user profile');
            }

            setData(result.data);
        } catch (err) {
            // Don't set error for aborted requests
            if (err instanceof Error && err.name === 'AbortError') {
                return;
            }

            console.error('Failed to fetch user profile:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch user profile');
        } finally {
            setIsLoading(false);
        }
    }, [enabled, userId]);

    // Initial fetch and setup interval
    useEffect(() => {
        if (!enabled || !userId) return;

        fetchUserProfile();

        // Set up auto-refresh interval
        if (refreshInterval > 0) {
            intervalRef.current = setInterval(fetchUserProfile, refreshInterval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchUserProfile, refreshInterval, enabled, userId]);

    const refresh = useCallback(() => {
        fetchUserProfile();
    }, [fetchUserProfile]);

    return {
        data,
        isLoading,
        error,
        refresh
    };
}

// ========================================
// USER STATS HOOK (LIGHTER VERSION)
// ========================================

export function useUserStats(userId: string | null, options: { enabled?: boolean } = {}) {
    const { enabled = true } = options;

    const [data, setData] = useState<UserStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchUserStats = useCallback(async () => {
        if (!enabled || !userId) return;

        try {
            setIsLoading(true);
            setError(null);

            // Cancel previous request if ongoing
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new abort controller
            abortControllerRef.current = new AbortController();

            const url = new URL('/api/leaderboard', window.location.origin);
            url.searchParams.set('action', 'user_stats');
            url.searchParams.set('userId', userId);

            const response = await fetch(url.toString(), {
                signal: abortControllerRef.current.signal,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch user stats');
            }

            setData(result.data.stats);
        } catch (err) {
            // Don't set error for aborted requests
            if (err instanceof Error && err.name === 'AbortError') {
                return;
            }

            console.error('Failed to fetch user stats:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch user stats');
        } finally {
            setIsLoading(false);
        }
    }, [enabled, userId]);

    // Fetch when dependencies change
    useEffect(() => {
        fetchUserStats();

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchUserStats]);

    const refresh = useCallback(() => {
        fetchUserStats();
    }, [fetchUserStats]);

    return {
        data,
        isLoading,
        error,
        refresh
    };
}

// ========================================
// UTILITY HOOKS
// ========================================

/**
 * Hook for initializing the leaderboard system
 */
export function useLeaderboardInit() {
    const [isInitializing, setIsInitializing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const initialize = useCallback(async () => {
        try {
            setIsInitializing(true);
            setError(null);

            const url = new URL('/api/leaderboard', window.location.origin);
            url.searchParams.set('action', 'init');

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to initialize leaderboard system');
            }

            console.log('Leaderboard system initialized successfully');
        } catch (err) {
            console.error('Failed to initialize leaderboard system:', err);
            setError(err instanceof Error ? err.message : 'Failed to initialize');
        } finally {
            setIsInitializing(false);
        }
    }, []);

    return {
        initialize,
        isInitializing,
        error
    };
}

/**
 * Combined hook for current user's profile (when user is connected)
 */
export function useCurrentUserProfile(userId: string | null) {
    const userProfile = useUserProfile(userId, {
        enabled: !!userId,
        refreshInterval: 30000 // 30 seconds for current user
    });

    return {
        ...userProfile,
        isCurrentUser: !!userId
    };
}

// ========================================
// ACHIEVEMENT HOOKS
// ========================================

/**
 * Hook for fetching all achievement definitions
 */
export function useAchievements(options: { enabled?: boolean; refreshInterval?: number } = {}) {
    const { enabled = true, refreshInterval = 300000 } = options; // 5 minutes default

    const [data, setData] = useState<AchievementsData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchAchievements = useCallback(async () => {
        if (!enabled) return;

        try {
            setIsLoading(true);
            setError(null);

            // Cancel previous request if ongoing
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new abort controller
            abortControllerRef.current = new AbortController();

            const url = new URL('/api/leaderboard', window.location.origin);
            url.searchParams.set('action', 'achievements');

            const response = await fetch(url.toString(), {
                signal: abortControllerRef.current.signal,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch achievements');
            }

            setData(result.data);
        } catch (err) {
            // Don't set error for aborted requests
            if (err instanceof Error && err.name === 'AbortError') {
                return;
            }

            console.error('Failed to fetch achievements:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch achievements');
        } finally {
            setIsLoading(false);
        }
    }, [enabled]);

    // Initial fetch and setup interval
    useEffect(() => {
        if (!enabled) return;

        fetchAchievements();

        // Set up auto-refresh interval
        if (refreshInterval > 0) {
            intervalRef.current = setInterval(fetchAchievements, refreshInterval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchAchievements, refreshInterval, enabled]);

    const refresh = useCallback(() => {
        fetchAchievements();
    }, [fetchAchievements]);

    return {
        data,
        isLoading,
        error,
        refresh
    };
}

/**
 * Hook for fetching user's achievements
 */
export function useUserAchievements(userId: string | null, options: { enabled?: boolean; refreshInterval?: number } = {}) {
    const { enabled = true, refreshInterval = 60000 } = options; // 1 minute default

    const [data, setData] = useState<UserAchievementsData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchUserAchievements = useCallback(async () => {
        if (!enabled || !userId) return;

        try {
            setIsLoading(true);
            setError(null);

            // Cancel previous request if ongoing
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new abort controller
            abortControllerRef.current = new AbortController();

            const url = new URL('/api/leaderboard', window.location.origin);
            url.searchParams.set('action', 'user_achievements');
            url.searchParams.set('userId', userId);

            const response = await fetch(url.toString(), {
                signal: abortControllerRef.current.signal,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch user achievements');
            }

            setData(result.data);
        } catch (err) {
            // Don't set error for aborted requests
            if (err instanceof Error && err.name === 'AbortError') {
                return;
            }

            console.error('Failed to fetch user achievements:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch user achievements');
        } finally {
            setIsLoading(false);
        }
    }, [enabled, userId]);

    // Initial fetch and setup interval
    useEffect(() => {
        if (!enabled || !userId) return;

        fetchUserAchievements();

        // Set up auto-refresh interval
        if (refreshInterval > 0) {
            intervalRef.current = setInterval(fetchUserAchievements, refreshInterval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchUserAchievements, refreshInterval, enabled, userId]);

    const refresh = useCallback(() => {
        fetchUserAchievements();
    }, [fetchUserAchievements]);

    return {
        data,
        isLoading,
        error,
        refresh
    };
} 