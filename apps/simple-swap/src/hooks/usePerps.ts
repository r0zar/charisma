import { useState, useEffect, useCallback } from 'react';
import { PerpetualPosition } from '@/lib/perps/types';
import { useWallet } from '@/contexts/wallet-context';

interface PnLData {
    pnl: number;
    pnlPercentage: number;
    isActive: boolean;
    status: 'pending' | 'open' | 'closed';
    currentPrice?: number;
    closeReason?: string;
    fundingFees: number;
}

// Global P&L cache to prevent duplicate requests for the same position
const pnlCache = new Map<string, {
    data: PnLData | null;
    isLoading: boolean;
    error: string | null;
    lastFetch: number;
    subscribers: Set<(data: any) => void>;
    interval?: NodeJS.Timeout;
}>();

const PNL_CACHE_DURATION = 30000; // 30 seconds
const PNL_POLL_INTERVAL = 60000; // 60 seconds to align with oracle updates

// Hook to fetch user's perpetual positions
export function usePerpetualPositions() {
    const [positions, setPositions] = useState<PerpetualPosition[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const { address } = useWallet();



    // Auto-fetch positions every 60 seconds + on refresh trigger changes
    useEffect(() => {
        const doFetch = async () => {
            console.log('🔍 Fetching perpetual positions for address:', address);

            if (!address) {
                console.log('❌ No wallet address found, setting positions to empty array');
                setPositions([]);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const url = `/api/v1/perps?owner=${address}`;
                console.log('📡 Fetching from:', url);

                const response = await fetch(url);
                const data = await response.json();

                console.log('📦 API Response:', {
                    status: response.status,
                    data: data,
                    positions: data.data
                });

                if (data.status === 'success') {
                    console.log('✅ Successfully fetched positions:', data.data);
                    setPositions(data.data);
                } else {
                    console.log('❌ API returned error:', data.error);
                    setError(data.error || 'Failed to fetch positions');
                }
            } catch (err) {
                console.error('❌ Network error fetching perps:', err);
                setError('Network error fetching positions');
            } finally {
                setIsLoading(false);
            }
        };

        doFetch();

        const interval = setInterval(doFetch, 60000);
        return () => clearInterval(interval);
    }, [address, refreshTrigger]);

    // Simple force refresh mechanism
    const forceRefresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    const refetch = useCallback(async () => {
        console.log('🔍 Fetching perpetual positions for address:', address);

        if (!address) {
            console.log('❌ No wallet address found, setting positions to empty array');
            setPositions([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const url = `/api/v1/perps?owner=${address}`;
            console.log('📡 Fetching from:', url);

            const response = await fetch(url);
            const data = await response.json();

            console.log('📦 API Response:', {
                status: response.status,
                data: data,
                positions: data.data
            });

            if (data.status === 'success') {
                console.log('✅ Successfully fetched positions:', data.data);
                setPositions(data.data);
            } else {
                console.log('❌ API returned error:', data.error);
                setError(data.error || 'Failed to fetch positions');
            }
        } catch (err) {
            console.error('❌ Network error fetching perps:', err);
            setError('Network error fetching positions');
        } finally {
            setIsLoading(false);
        }
    }, [address]);

    return {
        positions,
        isLoading,
        error,
        refetch,
        forceRefresh
    };
}

// Hook to get P&L for a specific position with shared caching
export function usePositionPnL(positionId: string | null) {
    const [pnlData, setPnlData] = useState<PnLData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!positionId) {
            setPnlData(null);
            setIsLoading(false);
            setError(null);
            return;
        }

        // Get or create cache entry
        let cacheEntry = pnlCache.get(positionId);
        if (!cacheEntry) {
            cacheEntry = {
                data: null,
                isLoading: false,
                error: null,
                lastFetch: 0,
                subscribers: new Set(),
            };
            pnlCache.set(positionId, cacheEntry);
        }

        // Subscribe to updates
        const updateLocal = (state: any) => {
            setPnlData(state.data);
            setIsLoading(state.isLoading);
            setError(state.error);
        };

        cacheEntry.subscribers.add(updateLocal);

        // Initial state sync
        updateLocal(cacheEntry);

        // Fetch if data is stale or missing
        const now = Date.now();
        const isStale = now - cacheEntry.lastFetch > PNL_CACHE_DURATION;

        if (!cacheEntry.data || isStale) {
            fetchPnLShared(positionId);
        }

        // Setup polling if not already active
        if (!cacheEntry.interval) {
            cacheEntry.interval = setInterval(() => {
                fetchPnLShared(positionId);
            }, PNL_POLL_INTERVAL);
        }

        // Cleanup on unmount
        return () => {
            const entry = pnlCache.get(positionId);
            if (entry) {
                entry.subscribers.delete(updateLocal);

                // Clear interval if no more subscribers
                if (entry.subscribers.size === 0 && entry.interval) {
                    clearInterval(entry.interval);
                    entry.interval = undefined;
                    // Optionally remove from cache after a delay
                    setTimeout(() => {
                        const currentEntry = pnlCache.get(positionId);
                        if (currentEntry && currentEntry.subscribers.size === 0) {
                            pnlCache.delete(positionId);
                        }
                    }, 30000); // Clean up after 30 seconds of no subscribers
                }
            }
        };
    }, [positionId]);

    return {
        pnlData,
        isLoading,
        error,
        refetch: () => positionId && fetchPnLShared(positionId)
    };
}

// Shared fetch function that updates all subscribers
async function fetchPnLShared(positionId: string) {
    const cacheEntry = pnlCache.get(positionId);
    if (!cacheEntry) return;

    // Prevent concurrent requests
    if (cacheEntry.isLoading) return;

    // Update loading state for all subscribers
    cacheEntry.isLoading = true;
    cacheEntry.error = null;
    cacheEntry.subscribers.forEach(callback => callback(cacheEntry));

    try {
        const response = await fetch(`/api/v1/perps/${positionId}/pnl`);
        const data = await response.json();

        if (response.ok && data) {
            cacheEntry.data = data;
            cacheEntry.error = null;
        } else {
            const errorMsg = `API Error: ${response.status} - ${data.error || 'Failed to fetch P&L'}`;
            cacheEntry.error = errorMsg;
            console.error(errorMsg, data);
        }
    } catch (err) {
        cacheEntry.error = 'Network error fetching P&L';
        console.error('Error fetching P&L:', err);
    } finally {
        cacheEntry.isLoading = false;
        cacheEntry.lastFetch = Date.now();

        // Notify all subscribers
        cacheEntry.subscribers.forEach(callback => callback(cacheEntry));
    }
}

// Hook to create a new perpetual position
export function useCreatePerpetualPosition() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createPosition = useCallback(async (positionData: any) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/v1/perps/new', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(positionData),
            });

            const data = await response.json();

            if (data.status === 'success') {
                return data.data;
            } else {
                setError(data.error || 'Failed to create position');
                throw new Error(data.error || 'Failed to create position');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Network error creating position';
            setError(errorMessage);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        createPosition,
        isLoading,
        error
    };
}

// Hook to cancel a perpetual position
export function useCancelPerpetualPosition() {
    const [cancelingPositions, setCancelingPositions] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    const cancelPosition = useCallback(async (positionId: string) => {
        setCancelingPositions(prev => new Set(prev).add(positionId));
        setError(null);

        try {
            const response = await fetch(`/api/v1/perps/${positionId}/cancel`, {
                method: 'POST',
            });

            const data = await response.json();

            if (data.status === 'success') {
                return data.data;
            } else {
                setError(data.error || 'Failed to cancel position');
                throw new Error(data.error || 'Failed to cancel position');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Network error canceling position';
            setError(errorMessage);
            throw err;
        } finally {
            setCancelingPositions(prev => {
                const newSet = new Set(prev);
                newSet.delete(positionId);
                return newSet;
            });
        }
    }, []);

    return {
        cancelPosition,
        cancelingPositions,
        error
    };
}

// Hook to start the monitoring service (for admin use)
export function usePerpsMonitor() {
    const [isStarting, setIsStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startMonitor = useCallback(async () => {
        setIsStarting(true);
        setError(null);

        try {
            const response = await fetch('/api/cron/perps-monitor', {
                method: 'POST',
            });

            const data = await response.json();

            if (data.status !== 'success') {
                setError(data.error || 'Failed to start monitor');
                throw new Error(data.error || 'Failed to start monitor');
            }

            return data;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Network error starting monitor';
            setError(errorMessage);
            throw err;
        } finally {
            setIsStarting(false);
        }
    }, []);

    const stopMonitor = useCallback(async () => {
        try {
            const response = await fetch('/api/cron/perps-monitor', {
                method: 'DELETE',
            });

            const data = await response.json();

            if (data.status !== 'success') {
                throw new Error(data.error || 'Failed to stop monitor');
            }

            return data;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Network error stopping monitor';
            setError(errorMessage);
            throw err;
        }
    }, []);

    return {
        startMonitor,
        stopMonitor,
        isStarting,
        error
    };
} 