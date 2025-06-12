"use client";

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/wallet-context';
import { MarginAccount } from '../lib/margin/types';
import { PerpetualPosition } from '../lib/perps/types';

interface TradingState {
    marginAccount: MarginAccount | null;
    positions: PerpetualPosition[];
    isLoading: boolean;
    error: string | null;
}

// Single hook that manages all trading-related state
export function useTradingState() {
    const [state, setState] = useState<TradingState>({
        marginAccount: null,
        positions: [],
        isLoading: false,
        error: null
    });

    const { address } = useWallet();

    // Simple fetch function - gets everything in one call
    const fetchTradingData = async () => {
        if (!address) {
            setState({
                marginAccount: null,
                positions: [],
                isLoading: false,
                error: null
            });
            return;
        }

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // Fetch both margin and positions in parallel
            const [marginResponse, positionsResponse] = await Promise.all([
                fetch(`/api/v1/margin?owner=${address}`),
                fetch(`/api/v1/perps?owner=${address}`)
            ]);

            const [marginData, positionsData] = await Promise.all([
                marginResponse.json(),
                positionsResponse.json()
            ]);

            setState({
                marginAccount: marginData.status === 'success' ? marginData.data : null,
                positions: positionsData.status === 'success' ? positionsData.data : [],
                isLoading: false,
                error: marginData.status !== 'success' ? marginData.error :
                    positionsData.status !== 'success' ? positionsData.error : null
            });
        } catch (err) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Network error loading trading data'
            }));
        }
    };

    // Deposit margin
    const depositMargin = useCallback(async (amount: number): Promise<boolean> => {
        if (!address) throw new Error('No wallet connected');

        console.log(`💰 Depositing ${amount} margin for ${address.substring(0, 8)}...`);

        try {
            const response = await fetch('/api/v1/margin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner: address, amount })
            });

            const data = await response.json();
            console.log('💰 Deposit response:', data);

            if (data.status === 'success') {
                // Update margin account in state
                setState(prev => ({ ...prev, marginAccount: data.data }));
                console.log('✅ Margin deposited successfully, state updated');
                return true;
            } else {
                console.error('❌ Deposit failed:', data.error);
                throw new Error(data.error || 'Failed to deposit margin');
            }
        } catch (err) {
            console.error('❌ Deposit network error:', err);
            throw err instanceof Error ? err : new Error('Network error');
        }
    }, [address]);

    // Withdraw margin
    const withdrawMargin = useCallback(async (amount: number): Promise<boolean> => {
        if (!address) throw new Error('No wallet connected');

        try {
            const response = await fetch('/api/v1/margin/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner: address, amount })
            });

            const data = await response.json();
            if (data.status === 'success') {
                setState(prev => ({ ...prev, marginAccount: data.data }));
                return true;
            } else {
                throw new Error(data.error || 'Failed to withdraw margin');
            }
        } catch (err) {
            throw err instanceof Error ? err : new Error('Network error');
        }
    }, [address]);

    // Reset margin account
    const resetMarginAccount = async (): Promise<void> => {
        if (!address) throw new Error('No wallet connected');

        try {
            const response = await fetch('/api/v1/margin/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner: address })
            });

            const data = await response.json();
            if (data.status === 'success') {
                setState(prev => ({ ...prev, marginAccount: data.data }));
            } else {
                throw new Error(data.error || 'Failed to reset margin account');
            }
        } catch (err) {
            throw err instanceof Error ? err : new Error('Network error');
        }
    };

    // Cancel position
    const cancelPosition = async (positionId: string): Promise<void> => {
        try {
            const response = await fetch(`/api/v1/perps/${positionId}/cancel`, {
                method: 'POST'
            });

            const data = await response.json();
            if (data.status === 'success') {
                // Refresh all data after position change
                await fetchTradingData();
            } else {
                throw new Error(data.error || 'Failed to cancel position');
            }
        } catch (err) {
            throw err instanceof Error ? err : new Error('Network error');
        }
    };

    // Sync P&L manually when user wants fresh data
    const syncPnL = async (): Promise<void> => {
        if (!address) return;

        try {
            await fetch('/api/v1/margin/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner: address })
            });

            // Fetch fresh data after sync
            await fetchTradingData();
        } catch (err) {
            console.warn('P&L sync failed:', err);
            // Still fetch data even if sync failed
            await fetchTradingData();
        }
    };

    // Utility functions
    const formatBalance = useCallback((amount: number): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }, []);

    const canOpenPosition = useCallback((marginRequired: number): boolean => {
        return state.marginAccount ? marginRequired <= state.marginAccount.freeMargin : false;
    }, [state.marginAccount]);

    const getLiquidationRisk = useCallback((): 'low' | 'medium' | 'high' => {
        if (!state.marginAccount) return 'low';
        const ratio = state.marginAccount.marginRatio;
        if (ratio > 80) return 'high';
        if (ratio > 50) return 'medium';
        return 'low';
    }, [state.marginAccount]);

    // Auto-load data when address changes
    useEffect(() => {
        const loadData = async () => {
            if (!address) {
                setState({
                    marginAccount: null,
                    positions: [],
                    isLoading: false,
                    error: null
                });
                return;
            }

            setState(prev => ({ ...prev, isLoading: true, error: null }));

            try {
                // Fetch both margin and positions in parallel
                const [marginResponse, positionsResponse] = await Promise.all([
                    fetch(`/api/v1/margin?owner=${address}`),
                    fetch(`/api/v1/perps?owner=${address}`)
                ]);

                const [marginData, positionsData] = await Promise.all([
                    marginResponse.json(),
                    positionsResponse.json()
                ]);

                setState({
                    marginAccount: marginData.status === 'success' ? marginData.data : null,
                    positions: positionsData.status === 'success' ? positionsData.data : [],
                    isLoading: false,
                    error: marginData.status !== 'success' ? marginData.error :
                        positionsData.status !== 'success' ? positionsData.error : null
                });
            } catch (err) {
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: 'Network error loading trading data'
                }));
            }
        };

        loadData();
    }, [address]);

    return {
        // State
        marginAccount: state.marginAccount,
        positions: state.positions,
        openPositions: state.positions.filter(p => p.status === 'open'),
        isLoading: state.isLoading,
        error: state.error,

        // Actions
        fetchTradingData,
        depositMargin,
        withdrawMargin,
        resetMarginAccount,
        cancelPosition,
        syncPnL,

        // Utilities
        formatBalance,
        canOpenPosition,
        getLiquidationRisk
    };
} 