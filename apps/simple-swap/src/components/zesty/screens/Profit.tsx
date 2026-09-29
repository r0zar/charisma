'use client';

import React from 'react';
import { tokenOfSubnet, toUnits } from '@/lib/zesty/config';
import { zestSatsOf, type Holdings } from '@/lib/zesty/plan';
import { formatAmount, formatSats, formatUsd } from '../use-zesty-money';
import type { ZestyTrade } from '../use-zesty-trade';

/** Green profit or orange loss, in dollars and percent of what went in. */
export function ProfitBanner({ profit, amountUsd, label }: { profit: number; amountUsd: number; label?: string }) {
  const gain = profit >= 0;
  const pct = (profit / amountUsd) * 100;
  return (
    <div className={`flex items-baseline justify-between rounded-xl px-4 py-3 ${gain ? 'bg-[#EAF7EE]' : 'bg-[#FFF4EF]'}`}>
      <span className="text-[13px] text-[#3D3D3D]">{label ?? (gain ? 'Profit' : 'Loss')}</span>
      <span className={`text-[24px] font-medium ${gain ? 'text-[#1B7A3A]' : 'text-[#B8410F]'}`}>
        {gain ? '+' : '−'}{formatUsd(Math.abs(profit))} <span className="text-[14px]">({gain ? '+' : '−'}{Math.abs(pct).toFixed(1)}%)</span>
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
  const profit = worth - trade.amountUsd;
  const inOther = (zestSats: number) => (held === 'zest' ? formatSats(amount * zestSats) : formatAmount('zest', (amount * 1e8) / zestSats));

  return (
    <>
      <ProfitBanner profit={profit} amountUsd={trade.amountUsd} label={profit >= 0 ? 'Up right now' : 'Down right now'} />
      <dl className="m-0 grid grid-cols-2 gap-x-4 text-[13px] text-[#3D3D3D]">
        <div>
          <dt>You put in</dt>
          <dd className="m-0 font-medium text-black">
            {formatAmount(held, amount)}<br />
            <span className="font-normal text-[#5C5C5C]">{inOther(trade.entrySats)} · {formatUsd(trade.amountUsd)}</span>
          </dd>
        </div>
        <div className="text-right">
          <dt>Worth now</dt>
          <dd className="m-0 font-medium text-black">
            {inOther(zestSatsOf(holdings))}<br />
            <span className="font-normal text-[#5C5C5C]">{formatUsd(worth)}</span>
          </dd>
        </div>
      </dl>
    </>
  );
}
