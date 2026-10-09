'use client';

import Link from 'next/link';
import { combineSubnets, type BalanceEntry, type BalanceSheet } from 'blaze-sdk';
import TokenLogo from '@/components/TokenLogo';
import { useBalances, useWalletBalances } from '@/contexts/wallet-balance-context';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import { usePrices } from '@/contexts/token-price-context';
import { formatTokenAmount } from '@/lib/swap-utils';
import { AnimatedAmount } from '@repo/brand/react';
import { InfoTooltip } from '@/components/ui/tooltip';
import { rollup } from './rollup';

type Tokens = ReturnType<typeof useTokenMetadata>['tokens'];

const STX = { contractId: '.stx', symbol: 'STX', name: 'Stacks', decimals: 6 };
// The token list has STX too (with its logo); the constant only covers the moment before the list loads
const metaOf = (tokens: Tokens, id: string) => tokens[id] ?? (id === '.stx' ? STX : { contractId: id, symbol: id.split('.')[1] ?? id, name: id, decimals: 6 });
const usd = (n: number) => (n !== 0 && Math.abs(n) < 0.01 ? '<$0.01' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }));
const short = (address?: string) => (address ? `${address.slice(0, 5)}…${address.slice(-4)}` : '');
/** The table's columns, each with a plain-words ⓘ: Standard and Blaze are added together in every one */
const COLUMNS = [
    { label: 'On the chain', hint: 'What the blockchain shows right now, with your Standard and Blaze balances added together.' },
    { label: 'Settling', hint: "Sent and waiting for a block. It counts right away, so your balance moves the moment you approve. A swap counts at its likely amount until it settles." },
    { label: 'Balance', hint: 'What you have: on the chain, plus what is settling. Standard and Blaze together.' },
    { label: 'Value', hint: 'Your balance at the current price.' },
    { label: 'Off the chain', hint: "Signed orders that haven't run yet, like DCA buys. Nothing is locked: it's still in your balance and you can move it. An order that finds it gone just skips." },
];

const ago = (at: number) => {
    const s = Math.max(1, Math.round((Date.now() - at) / 1000));
    return s < 60 ? `${s} s ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`;
};

function describe(e: BalanceEntry): { title: string; chip: string; tone: string } {
    const incoming = !e.amount.startsWith('-');
    if (e.stage === 'hold') return { title: e.note ?? (e.kind === 'bet' ? 'Meme Roulette bet' : 'Order'), chip: 'Off the chain', tone: 'bg-warning-soft text-warning' };
    const settling = { chip: 'Settling', tone: 'bg-blaze-soft text-blaze' };
    switch (e.kind) {
        case 'transfer':
            return incoming
                ? { title: `From ${short(e.counterparty)}`, chip: 'Arriving', tone: 'bg-accent-soft text-accent-text' }
                : { title: `To ${short(e.counterparty)}`, ...settling };
        case 'swap': return { title: incoming ? 'Swap, receiving' : 'Swap, paying', ...settling };
        case 'deposit': return { title: 'Moving to Blaze', ...settling };
        case 'withdraw': return { title: 'Moving to Standard', ...settling };
        case 'fee': return { title: 'Network fee', ...settling };
        default: return { title: 'Change', ...settling };
    }
}

function EntryRow({ entry, tokens }: { entry: BalanceEntry; tokens: Tokens }) {
    const token = metaOf(tokens, entry.token);
    const { title, chip, tone } = describe(entry);
    const amount = (raw: string) => formatTokenAmount(Number(raw), token.decimals ?? 6);
    const detail = [
        entry.min !== undefined ? `Likely amount, at least ${amount(entry.min)}` : entry.stage === 'pending' ? 'Exact amount' : null,
        entry.token.includes('subnet') ? 'on Blaze' : null,
        ago(entry.at),
    ].filter(Boolean).join(' · ');
    return (
        <li className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
            <TokenLogo token={token as never} size="sm" />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
                    {title}
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${tone}`}>{chip}</span>
                </div>
                <div className="text-xs text-ink-faint">
                    {detail}
                    {entry.txid && (
                        <> · <a className="hover:underline" href={`https://explorer.hiro.so/txid/${entry.txid}?chain=mainnet`} target="_blank" rel="noopener noreferrer">view</a></>
                    )}
                </div>
            </div>
            <div className="text-right font-mono text-sm tabular-nums text-ink">
                {entry.amount.startsWith('-') ? '' : '+'}{amount(entry.amount)} {token.symbol}
            </div>
        </li>
    );
}

function Group({ title, entries, tokens, empty, action }: { title: string; entries: BalanceEntry[]; tokens: Tokens; empty: string; action?: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <div className="flex items-center justify-between">
                <h2 className="font-mono text-xs uppercase tracking-wide text-ink-muted">{title} · {entries.length}</h2>
                {action}
            </div>
            {entries.length ? (
                <ul className="overflow-hidden rounded-xl border border-line bg-surface">
                    {entries.map(e => <EntryRow key={e.id} entry={e} tokens={tokens} />)}
                </ul>
            ) : (
                <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-ink-faint">{empty}</p>
            )}
        </section>
    );
}

/**
 * The full story behind a wallet's instant balances: every token's settled, on-its-way and set-aside amounts, and every
 * entry behind them, grouped by stage so a long list of orders still reads as a short one. Live, like every balance.
 */
export function BalanceBreakdown({ address, token }: { address: string; token?: string }) {
    useBalances([address]);
    const { sheets, error } = useWalletBalances();
    const { tokens } = useTokenMetadata();
    const { getPrice } = usePrices();
    const sheet: BalanceSheet | undefined = sheets[address];

    if (!sheet) {
        return <p className="py-16 text-center text-sm text-ink-muted">{error ?? 'Reading your balances from the chain…'}</p>;
    }

    const combined = combineSubnets(sheet);
    const rows = Object.entries(combined)
        .filter(([base, c]) => (!token || base === token) && (c.ready !== '0' || c.pending !== '0' || c.held !== '0'))
        .map(([base, c]) => {
            const meta = metaOf(tokens, base);
            const price = getPrice(base);
            const value = price === null || c.ready === null ? null : (Number(c.ready) / 10 ** (meta.decimals ?? 6)) * price;
            return { base, c, r: rollup(sheet, c.tokens), meta, value };
        })
        // Anything changing first, then the most valuable, then the rest by name
        .sort((a, b) => Number(b.r.entries.length > 0) - Number(a.r.entries.length > 0) || (b.value ?? 0) - (a.value ?? 0) || a.meta.symbol.localeCompare(b.meta.symbol));
    const totalValue = rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
    const unpriced = rows.filter(row => row.value === null).length;
    const shown = new Set(rows.flatMap(row => row.c.tokens));
    const entries = Object.values(sheet.tokens).flatMap(t => t.entries).filter(e => shown.has(e.token)).sort((a, b) => b.at - a.at);
    const failed = sheet.failed.filter(f => f.entries.some(e => shown.has(e.token)));
    const over = rows.filter(row => row.r.over > 0n);

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-ink">{token ? `${metaOf(tokens, token).symbol} balance` : 'Your balances'}</h1>
                    <p className="flex items-center gap-2 text-sm text-ink-muted">
                        <span className="inline-block h-2 w-2 rounded-full bg-success" aria-hidden /> Live · {short(address)} · block {sheet.block.toLocaleString('en-US')}
                    </p>
                </div>
                <div className="text-right">
                    <div className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">Total value</div>
                    <div className="text-2xl font-semibold tabular-nums text-ink"><AnimatedAmount value={totalValue} format={usd} /></div>
                    <div className="text-xs text-ink-faint">
                        {unpriced > 0 && `${unpriced} without a price · `}
                        {token ? <Link href="/balances" className="font-medium text-accent-text hover:underline">Show every token</Link> : 'At current prices'}
                    </div>
                </div>
            </div>

            {over.map(({ base, r, meta }) => (
                <p key={base} className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                    <strong>{meta.symbol} is over by {formatTokenAmount(Number(r.over), meta.decimals ?? 6)}.</strong> Your open orders count on more {meta.symbol} than you hold. Orders that can&apos;t be paid will skip until you add {meta.symbol} or cancel one.
                </p>
            ))}

            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                <table className="w-full min-w-[640px] text-sm">
                    <thead>
                        <tr className="border-b border-line text-right font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                            <th className="px-4 py-2 text-left font-normal">Token</th>
                            {COLUMNS.map(({ label, hint }) => (
                                <th key={label} className="px-4 py-2 font-normal">
                                    <span className="inline-flex items-center gap-1">{label} <InfoTooltip content={hint} /></span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ base, r, meta, value }) => {
                            const d = meta.decimals ?? 6;
                            const cell = (n: bigint | null) => (n === null ? "Couldn't read" : n === 0n ? '0' : formatTokenAmount(Number(n), d));
                            return (
                                <tr key={base} className="border-b border-line text-right font-mono tabular-nums text-ink-body last:border-b-0">
                                    <td className="px-4 py-2.5 text-left font-sans">
                                        <Link href={`/balances?token=${encodeURIComponent(base)}`} className="inline-flex items-center gap-2 font-medium text-ink hover:underline">
                                            <TokenLogo token={meta as never} size="sm" /> {meta.symbol}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-2.5">{cell(r.settled)}</td>
                                    <td className="px-4 py-2.5">{cell(r.pending)}</td>
                                    <td className="px-4 py-2.5 font-medium text-ink">
                                        {r.ready === null ? '—' : <AnimatedAmount value={Number(r.ready)} format={n => formatTokenAmount(n, d)} />}
                                    </td>
                                    <td className="px-4 py-2.5 text-ink-body">{value === null ? '—' : <AnimatedAmount value={value} format={usd} />}</td>
                                    <td className={`px-4 py-2.5 ${r.over > 0n ? 'text-danger' : 'text-ink-muted'}`}>{cell(-r.held)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Group title="Settling" entries={entries.filter(e => e.stage === 'pending')} tokens={tokens} empty="Nothing settling." />
            <Group
                title="Off the chain"
                entries={entries.filter(e => e.stage === 'hold')}
                tokens={tokens}
                empty="No open orders."
                action={<Link href="/orders" className="text-xs font-medium text-accent-text hover:underline">Manage orders →</Link>}
            />
            {failed.length > 0 && (
                <Group title="Didn't go through" entries={failed.flatMap(f => f.entries)} tokens={tokens} empty="" />
            )}
            <p className="text-xs text-ink-faint">
                Swaps count at their likely amount until they settle. Signed orders live off the chain and lock nothing: the money stays in your balance until they run, and an order that finds it gone skips.
            </p>
        </div>
    );
}
