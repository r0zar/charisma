'use client';

import React from 'react';
import { exitsFor, outcomeUsd, type Side } from '@/lib/zesty/plan';
import { BigButton, Card, Chip, Progress, StepTitle, TokenIcon } from '../ui';
import { formatPrice, formatUsd } from '../use-zesty-money';

export const TARGET_CHOICES = [0.1, 0.15, 0.25];
export const SAFETY_PCT = 0.1;

export function SetIt({ side, amountUsd, zestPrice, converts, targetPct, setTargetPct, safetyOn, setSafetyOn, onStart, onBack }: {
  side: Side;
  amountUsd: number;
  zestPrice: number;
  converts: boolean;
  targetPct: number;
  setTargetPct: (pct: number) => void;
  safetyOn: boolean;
  setSafetyOn: (on: boolean) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const { target, safety } = exitsFor(side, zestPrice, targetPct, safetyOn ? SAFETY_PCT : null);
  const up = side === 'up';
  const win = outcomeUsd(side, amountUsd, targetPct, converts);
  const worst = safety ? outcomeUsd(side, amountUsd, -SAFETY_PCT, converts) : null;

  return (
    <>
      <Progress step={3} />
      <StepTitle eyebrow={`Step 3 of 4 · ZEST goes ${side}`} title="Set your trade" />
      <div className="flex items-center justify-between rounded-2xl border border-[#E5E5E5] bg-white px-5 py-3.5">
        <span className="text-[15px] text-[#3D3D3D]">Putting <strong className="text-[20px] font-medium text-black">{formatUsd(amountUsd)}</strong> on ZEST</span>
        <button type="button" onClick={onBack} className="min-h-[44px] text-[14px] text-[#B8410F] underline">Change</button>
      </div>
      <Card className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="flex items-center gap-2 text-[14px] text-[#3D3D3D]"><TokenIcon token="zest" size={22} />{up ? 'Sell when ZEST hits' : 'Buy ZEST when it hits'}</span>
          <span className="text-[26px] font-medium">{formatPrice(target.price)}</span>
        </div>
        <div className="flex gap-2">
          {TARGET_CHOICES.map(pct => (
            <Chip key={pct} active={pct === targetPct} onClick={() => setTargetPct(pct)}>{up ? '+' : '−'}{pct * 100}%</Chip>
          ))}
        </div>
      </Card>
      <Card className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <label htmlFor="zesty-safety" className="text-[15px] font-medium">Safety net</label>
          <input id="zesty-safety" type="checkbox" checked={safetyOn} onChange={e => setSafetyOn(e.target.checked)} className="h-[22px] w-[22px] accent-black" />
        </div>
        <span className="text-[14px] leading-snug text-[#3D3D3D]">
          {up ? 'Sell' : 'Buy ZEST'} if it {up ? 'drops' : 'rises'} to <strong className="font-medium text-black">{formatPrice(zestPrice * (up ? 1 - SAFETY_PCT : 1 + SAFETY_PCT))}</strong> ({up ? '−' : '+'}{SAFETY_PCT * 100}%), so a bad day stays small.
        </span>
      </Card>
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1 rounded-[14px] bg-black p-3.5 text-white">
          <span className="text-[12px] tracking-[0.12em] text-[#D9D9D9]">IF IT HITS</span>
          <span className="text-[24px] font-medium text-[#FC6432]">≈ +{formatUsd(win)}</span>
        </div>
        <div className="flex flex-1 flex-col gap-1 rounded-[14px] border border-[#E5E5E5] bg-white p-3.5">
          <span className="text-[12px] tracking-[0.12em] text-[#5C5C5C]">WORST CASE</span>
          <span className="text-[24px] font-medium">{worst === null ? 'No limit' : `≈ −${formatUsd(Math.abs(worst))}`}</span>
        </div>
      </div>
      <p className="m-0 text-[12px] text-[#5C5C5C]">Estimates include about 1% per swap. {up ? 'Gains are in dollars.' : 'Gains are extra ZEST at the lower price.'}</p>
      <div className="mt-auto flex flex-col gap-3">
        <BigButton onClick={onStart}>Start trade</BigButton>
      </div>
    </>
  );
}
