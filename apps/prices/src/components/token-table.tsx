'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { TokenPrice } from '@/lib/market';
import { formatCompact, formatPrice, formatSats } from '@/lib/format';
import { Change } from './change';
import { Sparkline } from './sparkline';
import { TokenLogo } from './token-logo';

type SortKey = 'liquidity' | 'price' | '1h' | '24h' | '7d' | '30d';
type Tab = 'all' | 'gainers' | 'losers';
const value = (t: TokenPrice, key: SortKey) =>
  key === 'liquidity' ? t.liquidityUsd : key === 'price' ? t.usd : t.change[key] ?? -Infinity;

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: 'price', label: 'Price', className: '' },
  { key: '1h', label: '1h', className: 'hidden md:table-cell' },
  { key: '24h', label: '24h', className: '' },
  { key: '7d', label: '7d', className: 'hidden sm:table-cell' },
  { key: '30d', label: '30d', className: 'hidden lg:table-cell' },
  { key: 'liquidity', label: 'Liquidity', className: 'hidden md:table-cell' },
];

/** Every priced token, sortable, with gainers and losers tabs and a filter */
export function TokenTable({ tokens }: { tokens: TokenPrice[] }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'liquidity', desc: true });
  const [tab, setTab] = useState<Tab>('all');
  const [filter, setFilter] = useState('');

  const q = filter.trim().toLowerCase();
  const rows = tokens
    .filter(t => t.type !== 'SUBNET')
    .filter(t => !q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.contractId.toLowerCase().includes(q))
    .filter(t => tab === 'all' || (tab === 'gainers' ? (t.change['24h'] ?? 0) > 0 : (t.change['24h'] ?? 0) < 0));
  const key = tab === 'all' ? sort.key : '24h';
  const desc = tab === 'all' ? sort.desc : tab === 'gainers';
  rows.sort((a, b) => (desc ? value(b, key) - value(a, key) : value(a, key) - value(b, key)));

  const header = (col: (typeof COLUMNS)[number]) => {
    const on = tab === 'all' && sort.key === col.key;
    const Arrow = sort.desc ? ArrowDown : ArrowUp;
    return (
      <th key={col.key} className={`px-3 py-2 text-right font-medium ${col.className}`} aria-sort={on ? (sort.desc ? 'descending' : 'ascending') : undefined}>
        <button type="button" onClick={() => { setTab('all'); setSort(s => ({ key: col.key, desc: s.key === col.key ? !s.desc : true })); }} className="inline-flex items-center gap-1 hover:text-ink">
          {col.label}{on && <Arrow className="h-3 w-3" aria-hidden />}
        </button>
      </th>
    );
  };

  return (
    <section className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
        {(['all', 'gainers', 'losers'] as Tab[]).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${tab === t ? 'bg-surface-selected text-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'}`}>
            {t === 'all' ? 'All tokens' : t}
          </button>
        ))}
        <input id="token-filter" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter" aria-label="Filter tokens"
          className="ml-auto h-8 w-36 rounded-md border border-line bg-surface-sunken px-2.5 text-sm outline-none focus:border-accent-line sm:w-48" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-[11px] uppercase tracking-[0.08em] text-ink-muted">
            <tr className="border-b border-line">
              <th className="w-10 px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Token</th>
              {COLUMNS.map(header)}
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Last 7 days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.contractId} className="border-b border-line-soft transition-colors last:border-0 hover:bg-surface-hover">
                <td className="px-3 py-2.5 text-xs text-ink-faint tabular-nums">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <Link href={`/token/${t.contractId}`} className="flex items-center gap-2.5">
                    <TokenLogo src={t.image} symbol={t.symbol} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="font-semibold">{t.symbol}</span>
                        {t.thin && <span title={`Buying about $1 and selling it straight back loses ${t.roundTripLoss?.toFixed(0)}%`} className="rounded bg-warning-soft px-1 text-[10px] font-semibold uppercase text-warning">Thin</span>}
                        {t.stale && <span title={`Last priced ${t.updatedAt}`} className="rounded bg-surface-raised px-1 text-[10px] font-semibold uppercase text-ink-muted">Stale</span>}
                      </span>
                      <span className="block max-w-[180px] truncate text-xs text-ink-muted">{t.name}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="block font-semibold tabular-nums">{formatPrice(t.usd)}</span>
                  <span className="block text-xs text-ink-muted tabular-nums">{formatSats(t.sbtc)}</span>
                </td>
                <td className="hidden px-3 py-2.5 text-right md:table-cell"><Change value={t.change['1h']} /></td>
                <td className="px-3 py-2.5 text-right"><Change value={t.change['24h']} /></td>
                <td className="hidden px-3 py-2.5 text-right sm:table-cell"><Change value={t.change['7d']} /></td>
                <td className="hidden px-3 py-2.5 text-right lg:table-cell"><Change value={t.change['30d']} /></td>
                <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">{t.liquidityUsd ? formatCompact(t.liquidityUsd) : '—'}</td>
                <td className="hidden px-3 py-1.5 text-right sm:table-cell"><span className="inline-block"><Sparkline points={t.sparkline} /></span></td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-ink-muted">No tokens match. Try another name or clear the filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
