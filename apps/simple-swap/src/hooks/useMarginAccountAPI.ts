"use client";

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/wallet-context';
import { MarginAccount } from '../lib/margin/types';

export function useMarginAccountAPI() {
    const [account, setAccount] = useState<MarginAccount | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { address } = useWallet();



    // Auto-fetch on address change (without P&L sync to prevent loops)
    useEffect(() => {
        if (!address) {
            setAccount(null);
            return;
        }

        let cancelled = false;

        const doFetch = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/v1/margin?owner=${address}`);
                const data = await response.json();

                if (!cancelled) {
                    if (data.status === 'success') {
                        setAccount(data.data);
                    } else {
                        setError(data.error || 'Failed to fetch margin account');
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to fetch margin account:', err);
                    setError('Network error fetching margin account');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        doFetch();

        return () => {
            cancelled = true;
        };
    }, [address]);

    // Deposit margin
    const depositMargin = useCallback(async (amount: number): Promise<boolean> => {
        if (!address) {
            throw new Error('No wallet connected');
        }

        try {
            const response = await fetch('/api/v1/margin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner: address, amount })
            });

            const data = await response.json();

            if (data.status === 'success') {
                setAccount(data.data);
                return true;
            } else {
                throw new Error(data.error || 'Failed to deposit margin');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Network error';
            throw new Error(message);
        }
    }, [address]);

    // Withdraw margin
    const withdrawMargin = useCallback(async (amount: number): Promise<boolean> => {
        if (!address) {
            throw new Error('No wallet connected');
        }

        try {
            const response = await fetch('/api/v1/margin/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner: address, amount })
            });

            const data = await response.json();

            if (data.status === 'success') {
                setAccount(data.data);
                return true;
            } else {
                throw new Error(data.error || 'Failed to withdraw margin');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Network error';
            throw new Error(message);
        }
    }, [address]);

    // Reset account
    const resetAccount = useCallback(async (): Promise<void> => {
        if (!address) {
            throw new Error('No wallet connected');
        }

        try {
            const response = await fetch('/api/v1/margin/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner: address })
            });

            const data = await response.json();

            if (data.status === 'success') {
                setAccount(data.data);
            } else {
                throw new Error(data.error || 'Failed to reset margin account');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Network error';
            throw new Error(message);
        }
    }, [address]);

    // Update margin usage (for internal use by position creation)
    const updateMarginUsage = useCallback(async (usedMarginChange?: number, unrealizedPnL?: number): Promise<void> => {
        if (!address) return;

        try {
            const response = await fetch('/api/v1/margin/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner: address,
                    usedMarginChange,
                    unrealizedPnL
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                setAccount(data.data);
            } else {
                console.error('Failed to update margin usage:', data.error);
            }
        } catch (err) {
            console.error('Network error updating margin usage:', err);
        }
    }, [address]);

    // Utility functions
    const canOpenPosition = useCallback((marginRequired: number): boolean => {
        return account ? marginRequired <= account.freeMargin : false;
    }, [account]);

    const getMaxPositionSize = useCallback((leverage: number): number => {
        if (!account || leverage <= 0) return 0;
        return account.freeMargin * leverage;
    }, [account]);

    const getLiquidationRisk = useCallback((): 'low' | 'medium' | 'high' => {
        if (!account) return 'low';
        if (account.marginRatio > 80) return 'high';
        if (account.marginRatio > 50) return 'medium';
        return 'low';
    }, [account]);

    const isMarginCallLevel = useCallback((): boolean => {
        return account ? account.marginRatio > 50 : false;
    }, [account]);

    const formatBalance = useCallback((amount: number): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }, []);

    // Sync P&L and then fetch updated data
    const syncAndRefetch = useCallback(async (): Promise<void> => {
        if (!address) return;

        setIsLoading(true);
        setError(null);

        try {
            // First sync P&L
            await fetch('/api/v1/margin/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner: address })
            }).catch(err => {
                console.warn('P&L sync failed, continuing with fetch:', err);
            });

            // Then fetch updated data
            const response = await fetch(`/api/v1/margin?owner=${address}`);
            const data = await response.json();

            if (data.status === 'success') {
                setAccount(data.data);
            } else {
                setError(data.error || 'Failed to fetch margin account');
            }
        } catch (err) {
            console.error('Failed to sync and fetch margin account:', err);
            setError('Network error syncing margin account');
        } finally {
            setIsLoading(false);
        }
    }, [address]);

    return {
        // Account state
        account,
        isLoading,
        error,

        // Actions
        depositMargin,
        withdrawMargin,
        resetAccount,
        updateMarginUsage,
        refetch: useCallback(async () => {
            if (!address) {
                setAccount(null);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/v1/margin?owner=${address}`);
                const data = await response.json();

                if (data.status === 'success') {
                    setAccount(data.data);
                } else {
                    setError(data.error || 'Failed to fetch margin account');
                }
            } catch (err) {
                console.error('Failed to fetch margin account:', err);
                setError('Network error fetching margin account');
            } finally {
                setIsLoading(false);
            }
        }, [address]),
        syncAndRefetch,

        // Utilities
        canOpenPosition,
        getMaxPositionSize,
        getLiquidationRisk,
        isMarginCallLevel,
        formatBalance
    };
} 