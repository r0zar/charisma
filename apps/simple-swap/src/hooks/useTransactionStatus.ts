import { useState, useEffect } from 'react';

export type TransactionStatus = 'success' | 'abort_by_response' | 'abort_by_post_condition' | 'pending' | 'unknown';

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
}

/**
 * Hook to check the actual blockchain status of a transaction
 * This helps distinguish between "broadcasted" and "confirmed" transactions
 * For now, we'll just show pending status for filled orders with txids
 * The transaction monitoring cron job will handle the actual status checking
 */
export function useTransactionStatus(txid: string | null | undefined): TransactionStatusInfo {
    const [status, setStatus] = useState<TransactionStatus>('unknown');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!txid) {
            setStatus('unknown');
            setIsLoading(false);
            return;
        }

        // For now, if there's a txid, assume it's pending
        // The actual status checking is handled by the cron job
        setStatus('pending');
        setIsLoading(false);
        
    }, [txid]);

    const isConfirmed = status === 'success';
    const isFailed = status === 'abort_by_response' || status === 'abort_by_post_condition';
    const isPending = status === 'pending' || (!!txid && status === 'unknown');

    return {
        status: !!txid && status === 'unknown' ? 'pending' : status,
        isLoading,
        isConfirmed,
        isFailed,
        isPending,
        error: undefined,
        blockHeight: undefined,
        blockTime: undefined,
        checkedAt: new Date().toISOString()
    };
}