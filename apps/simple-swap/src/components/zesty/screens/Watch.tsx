'use client';

import React from 'react';
import { BigButton, Card, ErrorNote, TokenIcon } from '../ui';
import { formatPrice } from '../use-zesty-money';
import type { Holdings } from '@/lib/zesty/plan';
import type { ZestyTrade } from '../use-zesty-trade';
import { LiveProfit } from './Profit';

export function Watch({ trade, zestPrice, holdings, busy, error, onSellNow, onCancel }: {
  trade: ZestyTrade;
  zestPrice: number | null;
  holdings: Holdings | null;
  busy: boolean;
  error: string | null;
  onSellNow: () => void;
  onCancel: () => void;
}) {
  const up = trade.side === 'up';
  const target = Number(trade.target?.targetPrice ?? 0);
  const floor = trade.safety ? Number(trade.safety.targetPrice) : null;
  const now = zestPrice ?? trade.entryPrice;
  const change = (now - trade.entryPrice) / trade.entryPrice;
  const gainPct = up ? change : -change;

  // Bar runs from the safety net (or entry) to the target; where "now" sits on it
  const start = floor ?? trade.entryPrice;
  const position = Math.min(1, Math.max(0, (now - start) / (target - start)));
  const entryPosition = Math.min(1, Math.max(0, (trade.entryPrice - start) / (target - start)));

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] tracking-[0.14em] text-[#5C5C5C]">{trade.state === 'converting' ? 'STARTING YOUR TRADE' : 'YOUR TRADE IS LIVE'}</span>
        <h1 className="m-0 text-[30px] leading-[1.1] font-medium uppercase">{up ? 'Betting ZEST goes up' : 'Betting ZEST goes down'}</h1>
        <p className="m-0 text-[16px] leading-relaxed text-[#3D3D3D]">
          {trade.state === 'converting'
            ? `We're ${up ? 'buying ZEST' : 'selling ZEST'} for you now. This takes about a minute.`
            : `You can close this page. We'll ${up ? 'sell' : 'buy'} for you when the price hits.`}
        </p>
      </div>
      <Card className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <span className="flex items-center gap-2 text-[14px] text-[#3D3D3D]"><TokenIcon token="zest" size={28} />ZEST now</span>
          <span className="text-[30px] font-medium">{formatPrice(now)}</span>
        </div>
        <LiveProfit trade={trade} holdings={holdings} />
        <div className="flex justify-between text-[14px]">
          <span className="text-[#3D3D3D]">Since you started</span>
          <span className="font-medium">{gainPct >= 0 ? '+' : ''}{(gainPct * 100).toFixed(1)}% for you</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="relative h-3 rounded-full bg-gradient-to-r from-[#D9D9D9] to-[#FC6432]">
            <div className="absolute top-[-4px] h-5 w-0.5 bg-[#5C5C5C]" style={{ left: `${entryPosition * 100}%` }} />
            <div className="absolute top-[-6px] h-6 w-6 -translate-x-1/2 rounded-full border-[3px] border-white bg-black" style={{ left: `${position * 100}%` }} />
          </div>
          <div className="flex justify-between text-[13px] text-[#3D3D3D]">
            <span>{floor === null ? 'Started' : 'Safety net'}<br /><strong className="font-medium text-black">{formatPrice(start)}</strong></span>
            <span className="text-right">{up ? 'Sell at' : 'Buy at'}<br /><strong className="font-medium text-black">{formatPrice(target)}</strong></span>
          </div>
        </div>
      </Card>
      {error && <ErrorNote message={error} />}
      <div className="mt-auto flex gap-3">
        <BigButton variant="outline" onClick={onSellNow} disabled={busy || trade.state !== 'waiting'}>{up ? 'Sell now' : 'Buy now'}</BigButton>
        <BigButton variant="quiet" onClick={onCancel} disabled={busy}>Cancel</BigButton>
      </div>
    </>
  );
}
