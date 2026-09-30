'use client';

import React from 'react';
import Link from 'next/link';
import type { Side } from '@/lib/zesty/plan';
import { Progress, SatsPrice, StepTitle, TokenIcon } from '../ui';
import { ZestChart } from '../ZestChart';
import { SHARE_TEXT, ShareLink } from '../Share';

const OPTIONS: { side: Side; title: string; body: string; icon: React.ReactNode; circle: string }[] = [
  {
    side: 'up',
    title: 'ZEST goes up',
    body: 'We sell your ZEST for you when it rises.',
    circle: 'bg-[#FC6432]',
    icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17l6-6 4 4 6-8" /><path d="M14 7h6v6" /></svg>,
  },
  {
    side: 'down',
    title: 'ZEST goes down',
    body: "We buy ZEST for you when it's cheaper.",
    circle: 'bg-black',
    icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l6 6 4-4 6 8" /><path d="M14 17h6v-6" /></svg>,
  },
];

export function PickSide({ zestSats, onPick }: { zestSats: number | null; onPick: (side: Side) => void }) {
  return (
    <>
      <Progress step={1} />
      <StepTitle eyebrow="Step 1 of 4" title="What will ZEST do?">
        <p className="m-0 flex items-center gap-2 text-[16px] text-[#3D3D3D]">
          <TokenIcon token="zest" size={24} />
          ZEST is <strong className="font-medium text-black">{zestSats === null ? '…' : <SatsPrice sats={zestSats} />}</strong> right now.
        </p>
      </StepTitle>
      <div className="lg:hidden"><ZestChart /></div>
      {OPTIONS.map(option => (
        <button
          key={option.side}
          type="button"
          onClick={() => onPick(option.side)}
          className="flex min-h-[120px] items-center gap-4 rounded-[18px] border-2 border-black bg-white px-5 py-6 text-left hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${option.circle}`}>{option.icon}</span>
          <span className="flex flex-col gap-1.5">
            <span className="text-[22px] font-medium uppercase">{option.title}</span>
            <span className="text-[15px] leading-snug text-[#3D3D3D]">{option.body}</span>
          </span>
        </button>
      ))}
      <ShareLink text={SHARE_TEXT.zesty} label="Share Zesty on X ↗" className="self-center" />
      <Link href="/zesty/how-it-works" className="mt-auto flex lg:hidden min-h-[44px] items-center justify-center gap-2 text-[14px] text-[#B8410F] underline underline-offset-4">
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#B8410F] text-[12px] no-underline">?</span>
        How does this work?
      </Link>
    </>
  );
}
