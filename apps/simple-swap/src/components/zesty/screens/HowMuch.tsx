'use client';

import React from 'react';
import { planFunding, toUsd, type Side } from '@/lib/zesty/plan';
import { BigButton, Card, Chip, ErrorNote, Progress, StepTitle } from '../ui';
import { formatUsd, type useZestyMoney } from '../use-zesty-money';

export function HowMuch({ side, money, amountUsd, setAmountUsd, onNext, onBack }: {
  side: Side;
  money: ReturnType<typeof useZestyMoney>;
  amountUsd: number;
  setAmountUsd: (usd: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const available = (money.zestyUsd ?? 0) + (money.walletUsd ?? 0);
  let plan: ReturnType<typeof planFunding> | null = null;
  let problem: string | null = null;
  if (!money.holdings) problem = 'Loading prices…';
  else if (amountUsd <= 0) problem = 'Enter an amount.';
  else {
    try {
      plan = planFunding(side, amountUsd, money.holdings);
    } catch (err) {
      problem = (err as Error).message;
    }
  }
  const fromWalletUsd = plan && money.holdings
    ? plan.adds.reduce((sum, add) => sum + toUsd(add.token, add.micro, money.holdings![add.token].price), 0)
    : 0;

  return (
    <>
      <Progress step={2} />
      <StepTitle eyebrow={`Step 2 of 4 · ZEST goes ${side}`} title="How much?" />
      <Card className="flex flex-col gap-4">
        <label htmlFor="zesty-amount" className="text-[14px] text-[#3D3D3D]">Amount to put on ZEST</label>
        <div className="flex items-baseline gap-1 border-b-2 border-[#E5E5E5] pb-1 transition-colors duration-200 hover:border-[#BDBDBD] focus-within:border-[#FC6432] focus-within:hover:border-[#FC6432]">
          <span className="text-[44px] font-medium">$</span>
          <input
            id="zesty-amount"
            inputMode="decimal"
            value={amountUsd ? String(amountUsd) : ''}
            onChange={e => setAmountUsd(Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
            placeholder="0"
            autoComplete="off"
            className="w-full bg-transparent text-[56px] font-medium caret-[#FC6432] outline-none placeholder:text-[#D0D0D0]"
          />
        </div>
        <div className="flex gap-2">
          {[0.25, 0.5, 1].map(share => (
            <Chip key={share} active={Math.abs(amountUsd - Math.floor(available * share)) < 1} onClick={() => setAmountUsd(Math.floor(available * share))}>
              {share === 1 ? 'ALL' : `${share * 100}%`}
            </Chip>
          ))}
        </div>
        <span className="text-[13px] text-[#5C5C5C]">You have {formatUsd(available)} in total</span>
      </Card>
      {plan && fromWalletUsd > 0 && (
        <p className="m-0 rounded-[14px] border border-[#FFD9C9] bg-[#FFF4EF] p-4 text-[14px] leading-relaxed text-[#3D3D3D]">
          We&apos;ll add <strong className="font-medium text-black">{formatUsd(fromWalletUsd)}</strong> from your wallet into Zesty when you approve. You can move it back any time.
        </p>
      )}
      {problem && amountUsd > 0 && <ErrorNote message={problem} />}
      <div className="mt-auto flex flex-col gap-3">
        <BigButton onClick={onNext} disabled={!plan}>Next</BigButton>
        <BigButton variant="quiet" onClick={onBack}>Back</BigButton>
      </div>
    </>
  );
}
