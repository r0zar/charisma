'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AreaSeries, ColorType, createChart, type UTCTimestamp } from 'lightweight-charts';
import { Chip } from './ui';

interface Point { time: number; sats: number }

/** ZEST priced in sBTC (shown as sats per ZEST), 7 or 30 days. */
export function ZestChart({ height = 150 }: { height?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const [days, setDays] = useState<7 | 30>(7);
  const [points, setPoints] = useState<Point[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPoints(null);
    setError(null);
    fetch(`/api/v1/zesty/chart?days=${days}`)
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Chart failed (${res.status})`);
        if (active) setPoints(body.points);
      })
      .catch(err => active && setError((err as Error).message));
    return () => { active = false; };
  }, [days]);

  useEffect(() => {
    if (!container.current || !points?.length) return;
    const chart = createChart(container.current, {
      height,
      layout: { background: { type: ColorType.Solid, color: '#FFFFFF' }, textColor: '#5C5C5C', fontFamily: 'Matter, sans-serif', attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: '#F0F0F0' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: days === 7 },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: '#FC6432',
      topColor: 'rgba(252, 100, 50, 0.25)',
      bottomColor: 'rgba(252, 100, 50, 0)',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
    });
    series.setData(points.map(p => ({ time: p.time as UTCTimestamp, value: p.sats })));
    chart.timeScale().fitContent();
    const resize = new ResizeObserver(([entry]) => chart.applyOptions({ width: entry.contentRect.width }));
    resize.observe(container.current);
    return () => { resize.disconnect(); chart.remove(); };
  }, [points, days, height]);

  const first = points?.[0]?.sats;
  const last = points?.[points.length - 1]?.sats;
  const change = first && last ? (last - first) / first : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#E5E5E5] bg-white p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[14px] text-[#3D3D3D]">ZEST in sBTC</span>
        {last && (
          <span className="text-[14px]">
            <strong className="font-medium">{last.toFixed(0)} sats</strong>
            {change !== null && <span className="ml-2 text-[#5C5C5C]">{change >= 0 ? '+' : ''}{(change * 100).toFixed(1)}% · {days}D</span>}
          </span>
        )}
      </div>
      {error ? (
        <p role="alert" className="m-0 text-[13px] text-[#8F310A]">{error}</p>
      ) : (
        <div ref={container} style={{ height }} className="w-full" aria-label={`ZEST price in sBTC over ${days} days`} />
      )}
      <div className="flex gap-2">
        <Chip active={days === 7} onClick={() => setDays(7)}>7 days</Chip>
        <Chip active={days === 30} onClick={() => setDays(30)}>30 days</Chip>
      </div>
    </div>
  );
}
