import { useState, useEffect, useCallback, useRef } from 'react';

interface BnsCacheEntry {
    displayName: string;
    timestamp: number;
    isLoading?: boolean;
}

interface UseBnsCacheResult {
    getDisplayNames: (userIds: string[]) => Promise<Record<string, string>>;
    clearCache: () => void;
    getCacheStats: () => { size: number; hitRate: number };
}

// Session cache duration (30 minutes)
const CACHE_DURATION = 30 * 60 * 1000;

// Helper function to truncate address for display
const truncateAddress = (address: string): string => {
    if (!address) return 'Anonymous';
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function useBnsCache(): UseBnsCacheResult {
    // Use useRef instead of useState to avoid dependency issues
    const cache = useRef<Record<string, BnsCacheEntry>>({});
    const cacheHits = useRef(0);
    const totalRequests = useRef(0);
    const activeRequests = useRef<Set<string>>(new Set());
    const pendingRequests = useRef<Map<string, Promise<string>>>(new Map());

    // Force re-render trigger for cache stats
    const [, forceUpdate] = useState({});
    const triggerUpdate = useCallback(() => forceUpdate({}), []);

    // Clean expired entries periodically
    useEffect(() => {
        const cleanupInterval = setInterval(() => {
            const now = Date.now();
            const currentCache = cache.current;
            let hasExpired = false;

            Object.entries(currentCache).forEach(([userId, entry]) => {
                if (now - entry.timestamp > CACHE_DURATION) {
                    delete currentCache[userId];
                    hasExpired = true;
                }
            });

            if (hasExpired) {
                triggerUpdate();
            }
        }, 5 * 60 * 1000); // Clean every 5 minutes

        return () => clearInterval(cleanupInterval);
    }, [triggerUpdate]);

    const getDisplayNames = useCallback(async (userIds: string[]): Promise<Record<string, string>> => {
        if (userIds.length === 0) return {};

        totalRequests.current += userIds.length;
        const now = Date.now();
        const result: Record<string, string> = {};
        const uncachedUserIds: string[] = [];
        const pendingUserIds: string[] = [];

        // Check cache and active requests first
        userIds.forEach(userId => {
            const cached = cache.current[userId];

            // Check if we have a valid cached entry
            if (cached && (now - cached.timestamp) < CACHE_DURATION && !cached.isLoading) {
                result[userId] = cached.displayName;
                cacheHits.current++;
            }
            // Check if there's already a pending request for this user
            else if (pendingRequests.current.has(userId)) {
                pendingUserIds.push(userId);
            }
            // Need to fetch this user
            else {
                uncachedUserIds.push(userId);
            }
        });

        console.log(`🎯 Client BNS Cache: ${userIds.length - uncachedUserIds.length - pendingUserIds.length}/${userIds.length} served from client cache`);

        // Wait for pending requests
        if (pendingUserIds.length > 0) {
            console.log(`⏳ Client BNS Cache: Waiting for ${pendingUserIds.length} pending requests`);
            const pendingResults = await Promise.all(
                pendingUserIds.map(userId => pendingRequests.current.get(userId)!)
            );
            pendingUserIds.forEach((userId, index) => {
                result[userId] = pendingResults[index];
            });
        }

        // Fetch uncached names from server API
        if (uncachedUserIds.length > 0) {
            console.log(`🌐 Client BNS Cache: Fetching ${uncachedUserIds.length} names from server`);

            // Create a single promise for this batch to prevent duplicate requests
            const batchPromise = (async () => {
                try {
                    // Mark users as being fetched
                    uncachedUserIds.forEach(userId => {
                        activeRequests.current.add(userId);
                        cache.current[userId] = {
                            displayName: truncateAddress(userId),
                            timestamp: now,
                            isLoading: true
                        };
                    });

                    const response = await fetch('/api/admin/bns-names', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ userIds: uncachedUserIds }),
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const { displayNames } = await response.json();

                    // Update cache with fetched names
                    const batchResults: Record<string, string> = {};
                    uncachedUserIds.forEach(userId => {
                        const displayName = displayNames[userId] || truncateAddress(userId);
                        cache.current[userId] = {
                            displayName,
                            timestamp: now,
                            isLoading: false
                        };
                        batchResults[userId] = displayName;
                        activeRequests.current.delete(userId);
                    });

                    // Clean up pending requests
                    uncachedUserIds.forEach(userId => {
                        pendingRequests.current.delete(userId);
                    });

                    triggerUpdate();
                    return batchResults;

                } catch (error) {
                    console.error('Client BNS Cache: Failed to fetch names from server:', error);

                    // Fallback to truncated addresses and remove loading state
                    const batchResults: Record<string, string> = {};
                    uncachedUserIds.forEach(userId => {
                        const fallbackName = truncateAddress(userId);
                        cache.current[userId] = {
                            displayName: fallbackName,
                            timestamp: now,
                            isLoading: false
                        };
                        batchResults[userId] = fallbackName;
                        activeRequests.current.delete(userId);
                        pendingRequests.current.delete(userId);
                    });

                    triggerUpdate();
                    return batchResults;
                }
            })();

            // Store individual promises for each user in this batch
            uncachedUserIds.forEach(userId => {
                const userPromise = batchPromise.then(results => results[userId]);
                pendingRequests.current.set(userId, userPromise);
            });

            // Wait for the batch to complete and add results
            const batchResults = await batchPromise;
            Object.assign(result, batchResults);
        }

        return result;
    }, []); // No dependencies to prevent function recreation

    const clearCache = useCallback(() => {
        cache.current = {};
        activeRequests.current.clear();
        pendingRequests.current.clear();
        cacheHits.current = 0;
        totalRequests.current = 0;
        triggerUpdate();
        console.log('🧹 Client BNS Cache: Cache cleared');
    }, [triggerUpdate]);

    const getCacheStats = useCallback(() => {
        const hitRate = totalRequests.current > 0 ? (cacheHits.current / totalRequests.current) * 100 : 0;
        return {
            size: Object.keys(cache.current).length,
            hitRate: Math.round(hitRate * 100) / 100
        };
    }, []);

    return {
        getDisplayNames,
        clearCache,
        getCacheStats
    };
} 