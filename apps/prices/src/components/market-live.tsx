'use client';

import { useEffect, useState } from 'react';
import type { TokenPrice } from '@/lib/market';
import { formatAge, formatPrice } from '@/lib/format';
import { Heatmap, WINDOWS, type Window } from './heatmap';
import { TokenTable } from './token-table';
import { Change } from './change';

export interface Market { btcUsd: number | null; updatedAt: string | null; tokens: TokenPrice[] }

/** "Updated 12s ago", ticking on its own so the rest of the page doesn't re-render every second */
function Age({ iso }: { iso: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!iso || now === null) return null;
  const stale = now - Date.parse(iso) > 15 * 60_000;
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${stale ? 'bg-warning' : 'animate-pulse bg-success'}`} aria-hidden />
      {stale ? 'Prices are delayed' : 'Live'} · updated {formatAge(iso, now)}
    </span>
  );
}

/** The home page's live market: headline stats, the heatmap and the token table, refreshed every minute */
export function MarketLive({ initial }: { initial: Market }) {
  const [market, setMarket] = useState(initial);
  const [span, setSpan] = useState<Window>('24h');

  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await fetch('/api/v1/prices?sparkline=1').catch(() => null);
      if (res?.ok) setMarket(await res.json());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const find = (id: string) => market.tokens.find(t => t.contractId === id);
  const stx = find('.stx');
  const headline = [
    { label: 'Bitcoin', value: market.btcUsd ? formatPrice(market.btcUsd) : '—', change: find('SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token')?.change['24h'] ?? null },
    { label: 'Stacks', value: stx ? formatPrice(stx.usd) : '—', change: stx?.change['24h'] ?? null },
    { label: 'Tokens priced', value: String(market.tokens.filter(t => t.type !== 'SUBNET').length), change: null },
    { label: 'Liquidity tracked', value: '$' + market.tokens.filter(t => t.type !== 'SUBNET').reduce((s, t) => s + t.liquidityUsd, 0).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 }), change: null },
  ];

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          {headline.map(h => (
            <div key={h.label}>
              <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">{h.label}</dt>
              <dd className="flex items-baseline gap-2 text-lg font-semibold tabular-nums">
                {h.value}{h.change !== null && <Change value={h.change} className="text-xs font-medium" />}
              </dd>
            </div>
          ))}
        </dl>
        <Age iso={market.updatedAt} />
      </div>

      <section className="rounded-lg border border-line bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <h2 className="text-sm font-semibold">Market map <span className="font-normal text-ink-muted">· sized by liquidity</span></h2>
          <div className="flex gap-1" role="group" aria-label="Change window">
            {WINDOWS.map(w => (
              <button key={w.key} type="button" onClick={() => setSpan(w.key)} aria-pressed={span === w.key}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${span === w.key ? 'bg-accent-soft text-accent-text' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'}`}>
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-2"><Heatmap tokens={market.tokens} span={span} /></div>
      </section>

      <TokenTable tokens={market.tokens} />
    </div>
  );
}
