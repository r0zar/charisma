import { useState, useEffect, useCallback, useRef } from 'react';
import type { HistoricSpinResult } from '@/app/api/historic-spins/route';

interface UseHistoricSpinsResult {
    data: HistoricSpinResult[];
    isLoading: boolean;
    error: string | null;
    hasMore: boolean;
    loadMore: () => void;
    refresh: () => void;
    total: number;
}

export function useHistoricSpins(initialLimit = 20): UseHistoricSpinsResult {
    const [data, setData] = useState<HistoricSpinResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [total, setTotal] = useState(0);

    // Use ref to track loading state without causing re-renders
    const isLoadingRef = useRef(false);
    const hasInitialized = useRef(false);

    const fetchSpins = useCallback(async (offset = 0, limit = initialLimit, append = false) => {
        // Prevent concurrent requests
        if (isLoadingRef.current) return;

        isLoadingRef.current = true;
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/historic-spins?limit=${limit}&offset=${offset}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch historic spins');
            }

            const newSpins = result.results || [];

            if (append) {
                setData(prev => [...prev, ...newSpins]);
            } else {
                setData(newSpins);
            }

            setTotal(result.pagination?.total || 0);
            setHasMore(newSpins.length === limit && (offset + limit) < (result.pagination?.total || 0));

        } catch (err) {
            console.error('Error fetching historic spins:', err);
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            isLoadingRef.current = false;
            setIsLoading(false);
        }
    }, [initialLimit]);

    const loadMore = useCallback(() => {
        if (!isLoadingRef.current && hasMore) {
            fetchSpins(data.length, initialLimit, true);
        }
    }, [fetchSpins, data.length, initialLimit, hasMore]);

    const refresh = useCallback(() => {
        if (!isLoadingRef.current) {
            setData([]);
            setHasMore(true);
            fetchSpins(0, initialLimit, false);
        }
    }, [fetchSpins, initialLimit]);

    // Initial load - only run once
    useEffect(() => {
        if (!hasInitialized.current) {
            hasInitialized.current = true;
            fetchSpins();
        }
    }, [fetchSpins]);

    return {
        data,
        isLoading,
        error,
        hasMore,
        loadMore,
        refresh,
        total
    };
} 