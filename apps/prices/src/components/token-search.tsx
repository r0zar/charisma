'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { TokenPrice } from '@/lib/market';
import { formatPrice } from '@/lib/format';
import { Change } from './change';
import { TokenLogo } from './token-logo';

/** Header search: type a name, symbol or contract id, then pick a token. Press / to focus. */
export function TokenSearch() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [tokens, setTokens] = useState<TokenPrice[] | null>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const load = () => {
    if (tokens) return;
    fetch('/api/v1/prices').then(r => r.json()).then(d => setTokens(d.tokens ?? [])).catch(() => setTokens([]));
  };

  const q = text.trim().toLowerCase();
  const matches = q && tokens
    ? tokens.filter(t => t.type !== 'SUBNET' && (t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.contractId.toLowerCase().includes(q))).slice(0, 8)
    : [];

  const go = (t: TokenPrice) => {
    setOpen(false);
    setText('');
    router.push(`/token/${t.contractId}`);
  };

  return (
    <div className="relative min-w-0 flex-1 md:max-w-md">
      <label className="flex h-9 items-center gap-2 rounded-lg border border-on-chrome/15 bg-on-chrome/5 px-3 text-on-chrome-muted focus-within:border-chrome-accent">
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <input
          ref={input}
          id="token-search"
          value={text}
          onFocus={() => { load(); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={e => { setText(e.target.value); setActive(0); setOpen(true); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, matches.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
            if (e.key === 'Enter' && matches[active]) go(matches[active]);
            if (e.key === 'Escape') input.current?.blur();
          }}
          placeholder="Search token or contract"
          aria-label="Search tokens"
          className="min-w-0 flex-1 bg-transparent text-sm text-on-chrome outline-none placeholder:text-on-chrome-muted"
        />
        <kbd className="hidden rounded border border-on-chrome/20 px-1.5 text-[11px] sm:inline">/</kbd>
      </label>
      {open && q && (
        <ul role="listbox" className="absolute inset-x-0 top-11 z-50 overflow-hidden rounded-lg border border-line bg-surface-raised text-ink shadow-[var(--shadow-overlay)]">
          {!tokens && <li className="px-3 py-2 text-sm text-ink-muted">Loading tokens…</li>}
          {tokens && !matches.length && <li className="px-3 py-2 text-sm text-ink-muted">No token matches “{text}”</li>}
          {matches.map((t, i) => (
            <li key={t.contractId} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); go(t); }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${i === active ? 'bg-surface-hover' : ''}`}
              >
                <TokenLogo src={t.image} symbol={t.symbol} size={22} />
                <span className="font-semibold">{t.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-ink-muted">{t.name}</span>
                <span className="tabular-nums">{formatPrice(t.usd)}</span>
                <Change value={t.change['24h']} className="w-16 text-right text-xs" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
