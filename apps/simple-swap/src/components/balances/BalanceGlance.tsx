'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useWalletBalances } from '@/contexts/wallet-balance-context';
import { formatTokenAmount } from '@/lib/swap-utils';
import { rollup } from './rollup';

/**
 * The ⓘ beside a balance: how the number is made, in three lines (on the chain, on its way, set aside), and a link to
 * the full breakdown. It lights up while something is still settling and turns red when signed orders promise more
 * than the wallet holds.
 */
export function BalanceGlance({ address, tokens, base, symbol, decimals }: {
    address: string;
    /** The contracts behind the shown number: the token on Stacks, or its Blaze subnets */
    tokens: string[];
    /** The token the full breakdown opens on */
    base: string;
    symbol: string;
    decimals: number;
}) {
    const { sheets } = useWalletBalances();
    const sheet = sheets[address];
    if (!sheet) return null;

    const r = rollup(sheet, tokens);
    const amount = (n: bigint) => formatTokenAmount(Number(n), decimals);
    const signed = (n: bigint) => (n > 0n ? `+${amount(n)}` : amount(n));
    const pendingCount = r.entries.filter(e => e.stage === 'pending').length;
    const heldCount = r.entries.filter(e => e.stage === 'hold').length;
    const over = r.ready !== null && r.ready < 0n;
    const settling = r.pending !== 0n || r.held !== 0n;
    const tone = over ? 'text-danger' : settling ? 'text-accent-text' : 'text-ink-faint hover:text-ink-muted';

    const row = (label: string, value: bigint, count?: number) => (
        <div className={`flex justify-between gap-3 ${value === 0n ? 'text-ink-faint' : 'text-ink-body'}`}>
            <span>{label}{count ? <span className="ml-1.5 font-mono text-[10px] text-ink-faint">{count}</span> : null}</span>
            <span className="font-mono tabular-nums">{value === 0n ? '0' : signed(value)}</span>
        </div>
    );

    return (
        // Balances sit inside rows that open the token picker: clicks here stay here
        <span className="inline-flex" onClick={e => e.stopPropagation()}>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={`How the ${symbol} balance is made`}
                    className={`inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition-colors ${tone}`}
                >
                    <Info className="h-3.5 w-3.5" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 space-y-2.5 border-line bg-surface-raised p-3 text-xs shadow-lg">
                <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">How we got this number</span>
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                        over ? 'bg-danger-soft text-danger' : settling ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'
                    }`}>
                        {over ? 'Over' : settling ? 'Estimated' : 'Settled'}
                    </span>
                </div>
                <div className="space-y-1.5">
                    <div className="flex justify-between gap-3 text-ink-body">
                        <span>On the chain</span>
                        <span className="font-mono tabular-nums">{r.settled === null ? "Couldn't read" : amount(r.settled)}</span>
                    </div>
                    {row('On its way', r.pending, pendingCount)}
                    {row('Set aside', r.held, heldCount)}
                </div>
                <div className="flex justify-between gap-3 border-t border-dashed border-line-strong pt-2 font-medium text-ink">
                    <span>Ready to use</span>
                    <span className={`font-mono tabular-nums ${over ? 'text-danger' : ''}`}>{r.ready === null ? '—' : `${amount(r.ready)} ${symbol}`}</span>
                </div>
                {over && (
                    <p className="rounded-md bg-danger-soft px-2 py-1.5 text-danger">
                        Your orders count on {amount(-r.ready!)} {symbol} more than you have. Some may skip until you add {symbol} or cancel one.
                    </p>
                )}
                {r.estimated && <p className="text-ink-muted">Includes a swap at its likely amount.</p>}
                <Link href={`/balances?token=${encodeURIComponent(base)}`} className="block font-medium text-accent-text hover:underline">
                    Full breakdown →
                </Link>
            </DropdownMenuContent>
        </DropdownMenu>
        </span>
    );
}
