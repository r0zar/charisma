'use client';

import React from 'react';
import Link from 'next/link';
import { SatsPrice, TokenIcon } from './ui';
import { ZestChart } from './ZestChart';

const STEPS = [
  ['Pick a side', 'Up or down'],
  ['Set a price', 'And a safety net'],
  ['Walk away', 'We finish it for you'],
];

/** Desktop left column: the market and a quick how-it-works, visible through every step. */
export function MarketPanel({ zestSats }: { zestSats: number | null }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="flex">
          <TokenIcon token="zest" size={48} />
          <span className="-ml-3 rounded-full border-[3px] border-[#F7F7F7]"><TokenIcon token="sbtc" size={48} /></span>
        </span>
        <div className="flex flex-col">
          <span className="text-[13px] tracking-[0.14em] text-[#5C5C5C]">ZEST / SBTC</span>
          <span className="text-[36px] leading-tight font-medium">{zestSats === null ? '…' : <SatsPrice sats={zestSats} />}</span>
        </div>
      </div>
      <ZestChart height={320} />
      <div className="grid grid-cols-3 gap-3">
        {STEPS.map(([title, body], i) => (
          <div key={title} className="flex flex-col gap-1 rounded-2xl border border-[#E5E5E5] bg-white p-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FC6432] text-[14px] font-medium">{i + 1}</span>
            <span className="mt-2 text-[15px] font-medium uppercase">{title}</span>
            <span className="text-[13px] text-[#5C5C5C]">{body}</span>
          </div>
        ))}
      </div>
      <Link href="/zesty/how-it-works" className="text-[14px] text-[#B8410F] underline underline-offset-4">How does this work?</Link>
    </div>
  );
}
