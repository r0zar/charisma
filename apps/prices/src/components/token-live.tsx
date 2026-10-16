'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { TokenPrice } from '@/lib/market';
import { formatPrice, formatSats } from '@/lib/format';
import { Change } from './change';
import { TokenLogo } from './token-logo';

const WINDOWS = [{ key: '1h', label: '1H' }, { key: '24h', label: '24H' }, { key: '7d', label: '7D' }, { key: '30d', label: '30D' }] as const;

/** Copies text, falling back to selecting it when the clipboard is blocked */
export function CopyButton({ text, label = 'Copy contract id' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={label} title={label} className="rounded p-1 text-ink-muted hover:bg-surface-hover hover:text-ink"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {})}>
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** The token's name, live price and changes, refreshed every minute */
export function TokenLive({ initial }: { initial: TokenPrice }) {
  const [t, setT] = useState(initial);

  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await fetch(`/api/v1/prices/${encodeURIComponent(initial.contractId)}`).catch(() => null);
      if (res?.ok) setT(await res.json());
    }, 60_000);
    return () => clearInterval(timer);
  }, [initial.contractId]);

  return (
    <section className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <TokenLogo src={t.image} symbol={t.symbol} size={44} />
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            {t.symbol} <span className="truncate text-sm font-normal text-ink-muted">{t.name}</span>
            {t.thin && <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning">Thin liquidity</span>}
            {t.stale && <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-muted">Stale</span>}
          </h1>
          <p className="flex items-center gap-1 font-mono text-xs text-ink-muted">
            <span className="truncate">{t.contractId}</span><CopyButton text={t.contractId} />
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="text-3xl font-bold tabular-nums">{formatPrice(t.usd)}</p>
          <p className="text-xs text-ink-muted tabular-nums">{formatSats(t.sbtc)}</p>
        </div>
        <dl className="grid grid-cols-4 overflow-hidden rounded-lg border border-line bg-surface text-center">
          {WINDOWS.map(w => (
            <div key={w.key} className="border-l border-line px-3 py-1.5 first:border-l-0">
              <dt className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">{w.label}</dt>
              <dd className="text-sm font-semibold"><Change value={t.change[w.key]} /></dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
