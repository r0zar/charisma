import { useState, useEffect } from 'react';
import { TxMonitorClient } from '@repo/tx-monitor-client';

export type TransactionStatus = 'success' | 'abort_by_response' | 'abort_by_post_condition' | 'pending' | 'broadcasted' | 'not_found' | 'unknown';

export interface TransactionStatusInfo {
    status: TransactionStatus;
    isLoading: boolean;
    isConfirmed: boolean;
    isFailed: boolean;
    isPending: boolean;
    error?: string;
    blockHeight?: number;
    blockTime?: number;
    checkedAt?: string;
    fromCache?: boolean;
}

// Initialize tx-monitor client
const txMonitorClient = new TxMonitorClient();

/**
 * Hook to check the actual blockchain status of a transaction using tx-monitor-client
 * This provides real-time transaction status checking with caching
 */
export function useTransactionStatus(txid: string | null | undefined): TransactionStatusInfo {
    const [status, setStatus] = useState<TransactionStatus>('unknown');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [blockHeight, setBlockHeight] = useState<number | undefined>();
    const [blockTime, setBlockTime] = useState<number | undefined>();
    const [checkedAt, setCheckedAt] = useState<string | undefined>();
    const [fromCache, setFromCache] = useState<boolean | undefined>();

    useEffect(() => {
        if (!txid) {
            setStatus('unknown');
            setIsLoading(false);
            setError(undefined);
            return;
        }

        let mounted = true;

        const checkStatus = async () => {
            if (!mounted) return;
            
            setIsLoading(true);
            setError(undefined);

            try {
                const txStatus = await txMonitorClient.getTransactionStatus(txid);
                
                if (!mounted) return;
                
                setStatus(txStatus.status);
                setBlockHeight(txStatus.blockHeight);
                setBlockTime(txStatus.blockTime);
                setCheckedAt(new Date(txStatus.checkedAt).toISOString());
                setFromCache(txStatus.fromCache);
                
            } catch (err) {
                if (!mounted) return;
                
                console.error('Error checking transaction status:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
                
                // If transaction not found, set appropriate status
                if (err instanceof Error && err.message.includes('not found')) {
                    setStatus('not_found');
                } else {
                    setStatus('pending'); // Fallback to pending for other errors
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        checkStatus();

        // Set up polling for pending transactions
        const interval = setInterval(() => {
            if (status === 'pending' || status === 'broadcasted') {
                checkStatus();
            }
        }, 10000); // Check every 10 seconds for pending transactions

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [txid, status]);

    const isConfirmed = status === 'success';
    const isFailed = status === 'abort_by_response' || status === 'abort_by_post_condition' || status === 'not_found';
    const isPending = status === 'pending' || status === 'broadcasted' || (!!txid && status === 'unknown');

    return {
        status: !!txid && status === 'unknown' ? 'pending' : status,
        isLoading,
        isConfirmed,
        isFailed,
        isPending,
        error,
        blockHeight,
        blockTime,
        checkedAt,
        fromCache
    };
}