'use client';

import React from 'react';
import { BigButton, ErrorNote, Progress, StepTitle } from '../ui';

export interface ApprovalStep {
  id: string;
  label: string;
  kind: 'wallet-call' | 'signature';
  status: 'todo' | 'active' | 'confirming' | 'done';
}

const STATUS_TEXT: Record<ApprovalStep['status'], string> = {
  todo: 'Next',
  active: 'Approve in your wallet now',
  confirming: 'Confirming on the blockchain (about a minute)…',
  done: 'Done',
};

export function Approve({ steps, error, onRetry }: { steps: ApprovalStep[]; error: string | null; onRetry: () => void }) {
  const current = steps.find(step => step.status === 'active');
  return (
    <>
      <Progress step={4} />
      <StepTitle eyebrow="Step 4 of 4" title={`Approve ${steps.length} ${steps.length === 1 ? 'time' : 'times'}`}>
        <p className="m-0 text-[16px] leading-relaxed text-[#3D3D3D]">
          Each approval lets Zesty make one trade for you, even while you&apos;re away. No fees to approve trades.
        </p>
      </StepTitle>
      <ol className="m-0 flex list-none flex-col overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white p-0">
        {steps.map((step, i) => (
          <li key={step.id} className={`flex items-center gap-3.5 p-4 ${i > 0 ? 'border-t border-[#E5E5E5]' : ''} ${step.status === 'active' || step.status === 'confirming' ? 'bg-[#FFF4EF]' : ''}`}>
            {step.status === 'done' ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
              </span>
            ) : (
              <span className={`h-8 w-8 shrink-0 rounded-full border-[3px] ${step.status === 'todo' ? 'border-[#D0D0D0]' : 'animate-pulse border-[#FC6432]'}`} />
            )}
            <span className="flex flex-col gap-0.5">
              <span className={`text-[16px] font-medium ${step.status === 'todo' ? 'text-[#5C5C5C]' : ''}`}>{step.label}</span>
              <span className={`text-[14px] ${step.status === 'active' ? 'text-[#8F310A]' : 'text-[#5C5C5C]'}`}>{STATUS_TEXT[step.status]}</span>
            </span>
          </li>
        ))}
      </ol>
      {error && (
        <>
          <ErrorNote message={error} />
          <BigButton onClick={onRetry}>Try again</BigButton>
        </>
      )}
      {current && !error && (
        <div className="mt-auto flex items-center gap-3 rounded-[14px] bg-[#141414] p-4 text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FC6432" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12h2" /><path d="M3 10h18" /></svg>
          <span className="text-[14px]">Check your wallet. A popup is waiting for you.</span>
        </div>
      )}
    </>
  );
}
