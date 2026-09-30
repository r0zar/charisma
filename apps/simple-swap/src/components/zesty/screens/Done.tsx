'use client';

import React from 'react';
import { BigButton, TokenIcon } from '../ui';
import { formatSats, formatUsd } from '../use-zesty-money';
import { exitSats } from '@/lib/zesty/plan';
import { SHARE_TEXT, shareOnX, shareWin } from '../Share';
import type { ZestyTrade } from '../use-zesty-trade';

const COPY: Record<'won' | 'stopped' | 'cancelled', { eyebrow: (t: ZestyTrade) => string; title: string; body: string }> = {
  won: {
    eyebrow: t => `ZEST HIT ${formatSats(exitSats(t.target?.targetPrice ?? '0')).toUpperCase()} · DONE`,
    title: 'Nice call',
    body: 'Zesty finished your trade for you.',
  },
  stopped: {
    eyebrow: t => `SAFETY NET AT ${formatSats(exitSats(t.safety?.targetPrice ?? '0')).toUpperCase()}`,
    title: 'Safety net caught it',
    body: 'ZEST moved the other way, so we got you out early.',
  },
  cancelled: {
    eyebrow: () => 'TRADE CANCELLED',
    title: 'All stopped',
    body: 'Nothing else will run. Your money is still in Zesty.',
  },
};

export function Done({ trade, zestyUsd, onAgain }: { trade: ZestyTrade; zestyUsd: number | null; onAgain: () => void }) {
  const copy = COPY[trade.state as keyof typeof COPY];
  return (
    <div className="flex flex-1 flex-col gap-5 rounded-3xl bg-black px-6 pt-12 pb-8 text-white">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex">
          <TokenIcon token="zest" size={56} />
          <span className="-ml-3.5 rounded-full border-[3px] border-black"><TokenIcon token="sbtc" size={56} /></span>
        </span>
        <span className="text-[13px] tracking-[0.14em] text-[#D9D9D9]">{copy.eyebrow(trade)}</span>
        <h1 className="m-0 text-[30px] font-medium text-[#FC6432] uppercase">{copy.title}</h1>
        <p className="m-0 text-[16px] leading-relaxed text-[#D9D9D9]">{copy.body}</p>
      </div>
      <div className="flex justify-between rounded-2xl bg-[#141414] p-4 text-[14px]">
        <span className="text-[#D9D9D9]">Money in Zesty</span>
        <span className="font-medium">{zestyUsd === null ? '…' : formatUsd(zestyUsd)}</span>
      </div>
      <p className="m-0 text-center text-[13px] text-[#D9D9D9]">Open Money to move it to your wallet.</p>
      <div className="mt-auto flex flex-col gap-3">
        <BigButton onClick={onAgain}>Trade again</BigButton>
        <BigButton
          variant="quiet"
          onClick={() => trade.state === 'won' && trade.target
            ? shareWin(trade.target).catch(() => shareOnX(SHARE_TEXT.finished))
            : shareOnX(SHARE_TEXT.finished)}
        >
          {trade.state === 'won' ? 'Share my win 🏆' : 'Share Zesty on X'}
        </BigButton>
      </div>
    </div>
  );
}
