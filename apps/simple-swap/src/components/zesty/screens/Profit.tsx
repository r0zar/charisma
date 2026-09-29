'use client';

import React from 'react';
import { tokenOfSubnet, toUnits, type ZestyTokenKey } from '@/lib/zesty/config';
import { inOther, otherToken, zestSatsOf, type Holdings } from '@/lib/zesty/plan';
import { formatAmount, formatUsd } from '../use-zesty-money';
import type { ZestyTrade } from '../use-zesty-trade';

/**
 * Green profit or orange loss in what the trade is for (sats when betting up, ZEST when betting down),
 * from `start` to `end` of `unit`, with the dollar change as a hint.
 */
export function ProfitBanner({ unit, start, end, usd, label }: { unit: ZestyTokenKey; start: number; end: number; usd: number; label?: string }) {
  const change = end - start;
  const gain = change >= 0;
  const sign = (n: number) => (n >= 0 ? '+' : '−');
  return (
    <div className={`flex items-baseline justify-between rounded-xl px-4 py-3 ${gain ? 'bg-[#EAF7EE]' : 'bg-[#FFF4EF]'}`}>
      <span className="text-[13px] text-[#3D3D3D]">{label ?? (gain ? 'Profit' : 'Loss')}</span>
      <span className="flex flex-col items-end">
        <span className={`text-[24px] font-medium ${gain ? 'text-[#1B7A3A]' : 'text-[#B8410F]'}`}>
          {sign(change)}{formatAmount(unit, Math.abs(change))} <span className="text-[14px]">({sign(change)}{Math.abs((change / start) * 100).toFixed(1)}%)</span>
        </span>
        <span className="text-[12px] text-[#5C5C5C]">{sign(usd)}{formatUsd(Math.abs(usd))}</span>
      </span>
    </div>
  );
}

/**
 * Where a live trade stands right now, and the profit if you sold.
 * What it holds is valued in what it's trading for: ZEST in sats when betting up, sats in ZEST when betting down.
 */
export function LiveProfit({ trade, holdings }: { trade: ZestyTrade; holdings: Holdings | null }) {
  // The target order holds everything the trade bought; nothing to value until the conversion has run
  if (trade.state !== 'waiting' || !trade.target || !holdings) return null;

  const held = tokenOfSubnet(trade.target.inputToken);
  const amount = toUnits(held, trade.target.amountIn);
  const worth = amount * holdings[held].price;
  const other = otherToken(held);
  const start = inOther(held, amount, trade.entrySats);
  const end = inOther(held, amount, zestSatsOf(holdings));

  return (
    <>
      <ProfitBanner unit={other} start={start} end={end} usd={worth - trade.amountUsd} label={end >= start ? 'Up right now' : 'Down right now'} />
      <dl className="m-0 grid grid-cols-2 gap-x-4 text-[13px] text-[#3D3D3D]">
        <div>
          <dt>You put in</dt>
          <dd className="m-0 font-medium text-black">
            {formatAmount(held, amount)}<br />
            <span className="font-normal text-[#5C5C5C]">{formatAmount(other, start)} · {formatUsd(trade.amountUsd)}</span>
          </dd>
        </div>
        <div className="text-right">
          <dt>Worth now</dt>
          <dd className="m-0 font-medium text-black">
            {formatAmount(other, end)}<br />
            <span className="font-normal text-[#5C5C5C]">{formatUsd(worth)}</span>
          </dd>
        </div>
      </dl>
    </>
  );
}
