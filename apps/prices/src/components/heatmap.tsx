'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import type { Change as ChangeWindows, TokenPrice } from '@/lib/market';
import { formatChange, formatPrice } from '@/lib/format';
import { TokenLogo } from './token-logo';

export type Window = keyof ChangeWindows;
export const WINDOWS: { key: Window; label: string }[] = [
  { key: '1h', label: '1H' }, { key: '24h', label: '1D' }, { key: '7d', label: '7D' }, { key: '30d', label: '30D' },
];
/** The change that paints a tile at full strength, per window */
const FULL: Record<Window, number> = { '1h': 3, '24h': 10, '7d': 20, '30d': 40 };
const TILES = 36;

/** Tokens as tiles sized by liquidity and colored by price change */
export function Heatmap({ tokens, span }: { tokens: TokenPrice[]; span: Window }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const picked = tokens.filter(t => t.type !== 'SUBNET' && t.liquidityUsd > 0).slice(0, TILES);
  const root = hierarchy<{ children?: TokenPrice[] } | TokenPrice>({ children: picked })
    .sum(d => ('liquidityUsd' in d ? Math.sqrt(d.liquidityUsd) : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const leaves = size.width ? treemap<{ children?: TokenPrice[] } | TokenPrice>().size([size.width, size.height]).paddingInner(2).tile(treemapSquarify)(root).leaves() : [];

  return (
    <div ref={box} className="relative h-[360px] w-full md:h-[440px]">
      {leaves.map(leaf => {
        const t = leaf.data as TokenPrice;
        const w = leaf.x1 - leaf.x0, h = leaf.y1 - leaf.y0;
        const change = t.change[span];
        const strength = change === null ? 0 : Math.min(1, Math.abs(change) / FULL[span]);
        const tone = change === null || change === 0 ? 'var(--surface-raised)' : `color-mix(in oklab, var(${change > 0 ? '--success' : '--danger'}) ${Math.round(18 + 52 * strength)}%, var(--surface))`;
        const big = w > 110 && h > 80, small = w < 54 || h < 36;
        return (
          <Link
            key={t.contractId}
            href={`/token/${t.contractId}`}
            title={`${t.symbol} ${formatPrice(t.usd)} ${formatChange(change)}`}
            style={{ left: leaf.x0, top: leaf.y0, width: w, height: h, background: tone }}
            className="absolute flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md p-1 text-center text-ink outline-offset-[-2px] transition-[filter] hover:brightness-125"
          >
            {big && <TokenLogo src={t.image} symbol={t.symbol} size={Math.min(40, h / 4)} />}
            {!small && <span className={`max-w-full truncate font-bold ${big ? 'text-base' : 'text-xs'}`}>{t.symbol}</span>}
            <span className={`tabular-nums ${big ? 'text-sm' : 'text-[10px]'} ${small ? 'font-bold' : ''}`}>{small ? t.symbol : formatChange(change)}</span>
          </Link>
        );
      })}
    </div>
  );
}
