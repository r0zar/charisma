'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { BalanceEntry, FailedTx } from 'blaze-sdk';
import { useWalletBalances } from '@/contexts/wallet-balance-context';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import { formatTokenAmount } from '@/lib/swap-utils';

const titles: Partial<Record<BalanceEntry['kind'], string>> = {
    swap: "Your swap didn't go through",
    transfer: "Your transfer didn't go through",
    deposit: "Your move to Blaze didn't go through",
    withdraw: "Your move to Standard didn't go through",
};

/**
 * When a pending transaction fails or is dropped, its balance change snaps back; this says so, once, with what came
 * back. Failures from before the page opened stay quiet.
 */
export function BalanceNotices() {
    const { sheets } = useWalletBalances();
    const { tokens } = useTokenMetadata();
    const told = useRef(new Set<string>());
    const openedAt = useRef(Date.now());

    useEffect(() => {
        for (const sheet of Object.values(sheets)) {
            for (const failed of sheet.failed) {
                if (told.current.has(failed.txid)) continue;
                told.current.add(failed.txid);
                if (failed.at < openedAt.current) continue;
                toast.error(titleOf(failed), { description: backOf(failed, tokens), duration: 8000 });
            }
        }
    }, [sheets, tokens]);

    return null;
}

const titleOf = (failed: FailedTx) =>
    titles[failed.entries.find(e => e.kind !== 'fee')?.kind ?? 'fee'] ?? "A transaction didn't go through";

/** "The network dropped it, so 100 STX is back." */
function backOf(failed: FailedTx, tokens: ReturnType<typeof useTokenMetadata>['tokens']): string {
    const why = failed.status.startsWith('dropped') ? 'The network dropped it' : 'It failed on the chain';
    const back = failed.entries
        .filter(e => e.kind !== 'fee' && e.amount.startsWith('-'))
        .map(e => {
            const token = e.token === '.stx' ? { symbol: 'STX', decimals: 6 } : tokens[e.token];
            return `${formatTokenAmount(-Number(e.amount), token?.decimals ?? 6)} ${token?.symbol ?? e.token.split('.')[1]}`;
        });
    return back.length ? `${why}, so ${back.join(' and ')} is back.` : `${why}.`;
}
