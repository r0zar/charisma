'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AreaSeries, CandlestickSeries, ColorType, createChart,
  type IChartApi, type ISeriesApi, type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle, Interval } from '@/lib/market';
import { formatPrice } from '@/lib/format';

const INTERVALS: { key: Interval; label: string }[] = [
  { key: '5m', label: '5m' }, { key: '1h', label: '1h' }, { key: '4h', label: '4h' }, { key: '1d', label: '1D' }, { key: '1w', label: '1W' },
];
type Unit = 'usd' | 'sats';

/** A brand hex color (#rgb, #rrggbb or #rrggbbaa) as rgba(), the form the chart library reads, with extra transparency */
function rgba(color: string, alpha = 1) {
  if (!color.startsWith('#')) return color;
  const hex = color.slice(1).length <= 4 ? [...color.slice(1)].map(c => c + c).join('') : color.slice(1);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return `rgba(${r}, ${g}, ${b}, ${+(a * alpha).toFixed(3)})`;
}

/** The theme's colors, read from the brand tokens so the chart follows light and dark */
function palette() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, alpha = 1) => rgba(css.getPropertyValue(name).trim(), alpha);
  return { text: v('--ink-muted'), grid: v('--line-soft'), line: v('--line-strong'), up: v('--success'), down: v('--danger'), accent: v('--accent'), fill: v('--accent', 0.3) };
}

/** Candles for one token, by interval, in dollars or sats */
export function PriceChart({ token }: { token: string }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const area = useRef<ISeriesApi<'Area'> | null>(null);
  const [size, setSize] = useState<Interval>('1h');
  const [unit, setUnit] = useState<Unit>('usd');
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | string>('loading');

  // Build the chart once, and repaint it when the theme changes
  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, { autoSize: true, layout: { background: { type: ColorType.Solid, color: 'transparent' }, attributionLogo: true }, rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, timeVisible: true } });
    candles.current = c.addSeries(CandlestickSeries, { borderVisible: false });
    area.current = c.addSeries(AreaSeries, { lineWidth: 2, visible: false });
    chart.current = c;
    const paint = () => {
      const p = palette();
      c.applyOptions({ layout: { textColor: p.text, fontFamily: getComputedStyle(document.body).fontFamily }, grid: { vertLines: { color: p.grid }, horzLines: { color: p.grid } }, crosshair: { vertLine: { color: p.line }, horzLine: { color: p.line } } });
      candles.current?.applyOptions({ upColor: p.up, downColor: p.down, wickUpColor: p.up, wickDownColor: p.down });
      area.current?.applyOptions({ lineColor: p.accent, topColor: p.fill, bottomColor: 'rgba(0, 0, 0, 0)' });
    };
    paint();
    const themeWatch = new MutationObserver(paint);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', paint);
    return () => { themeWatch.disconnect(); media.removeEventListener('change', paint); c.remove(); chart.current = null; };
  }, []);

  // Load candles whenever the interval or unit changes, and refresh them every 5 minutes
  useEffect(() => {
    let live = true;
    const load = async () => {
      const res = await fetch(`/api/v1/prices/${encodeURIComponent(token)}/history?interval=${size}&quote=${unit === 'usd' ? 'usd' : 'sbtc'}&limit=2000`);
      const json = await res.json();
      if (!live) return;
      if (!res.ok) return setStatus(json.error ?? `Couldn't load prices (HTTP ${res.status})`);
      const scale = unit === 'sats' ? 1e8 : 1;
      const rows = (json.candles as Candle[]).map(k => ({ time: k.time as UTCTimestamp, open: k.open * scale, high: k.high * scale, low: k.low * scale, close: k.close * scale }));
      const format = { type: 'custom' as const, minMove: 1e-12, formatter: (p: number) => formatPrice(p, unit === 'usd' ? '$' : '') };
      const asLine = size === '5m';
      candles.current?.applyOptions({ visible: !asLine, priceFormat: format });
      area.current?.applyOptions({ visible: asLine, priceFormat: format });
      candles.current?.setData(asLine ? [] : rows);
      area.current?.setData(asLine ? rows.map(r => ({ time: r.time, value: r.close })) : []);
      chart.current?.timeScale().fitContent();
      setStatus(rows.length ? 'ready' : 'empty');
    };
    setStatus('loading');
    load().catch(e => live && setStatus(e instanceof Error ? e.message : String(e)));
    const timer = setInterval(() => load().catch(() => {}), 5 * 60_000);
    return () => { live = false; clearInterval(timer); };
  }, [token, size, unit]);

  const pill = (on: boolean) => `rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${on ? 'bg-accent-soft text-accent-text' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'}`;
  return (
    <section className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex gap-1" role="group" aria-label="Candle size">
          {INTERVALS.map(i => <button key={i.key} type="button" aria-pressed={size === i.key} onClick={() => setSize(i.key)} className={pill(size === i.key)}>{i.label}</button>)}
        </div>
        <div className="flex gap-1" role="group" aria-label="Priced in">
          {(['usd', 'sats'] as Unit[]).map(u => <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={pill(unit === u)}>{u === 'usd' ? 'USD' : 'Sats'}</button>)}
        </div>
      </div>
      <div className="relative h-[360px] md:h-[460px]">
        <div ref={box} className="absolute inset-0" />
        {status !== 'ready' && (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-ink-muted">
            {status === 'loading' ? 'Loading prices…' : status === 'empty' ? 'No prices recorded in this range yet. Try a bigger candle size.' : status}
          </p>
        )}
      </div>
    </section>
  );
}
