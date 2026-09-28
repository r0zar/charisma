'use client';

import React from 'react';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import { ZESTY_TOKENS, type ZestyTokenKey } from '@/lib/zesty/config';

export function Progress({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-[#FC6432]' : 'bg-[#E0E0E0]'}`} />
      ))}
    </div>
  );
}

export function StepTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[13px] tracking-[0.14em] text-[#5C5C5C] uppercase">{eyebrow}</span>
      <h1 className="m-0 text-[32px] leading-[1.1] font-medium uppercase">{title}</h1>
      {children}
    </div>
  );
}

export function BigButton({ children, onClick, disabled, variant = 'primary' }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'quiet';
}) {
  const styles = {
    primary: 'bg-[#FC6432] text-black border-0 shadow-[0_1px_0_rgba(0,0,0,0.15)] hover:enabled:bg-[#FF7A4D] hover:enabled:shadow-[0_4px_14px_rgba(252,100,50,0.35)]',
    outline: 'bg-white text-black border-2 border-black hover:enabled:bg-black hover:enabled:text-white',
    quiet: 'bg-white text-[#3D3D3D] border border-[#D0D0D0] hover:enabled:border-black hover:enabled:text-black',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[56px] w-full rounded-[14px] px-4 text-[16px] font-medium tracking-[0.08em] uppercase ${styles}`}
    >
      {children}
    </button>
  );
}

export function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[44px] flex-1 rounded-full border text-[14px] ${active ? 'border-black bg-black text-white' : 'border-[#D0D0D0] bg-white text-black hover:border-black'}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[#E5E5E5] bg-white p-5 ${className}`}>{children}</div>;
}

export function TokenIcon({ token, size = 20 }: { token: ZestyTokenKey; size?: number }) {
  const { getTokenImage } = useTokenMetadata();
  const src = getTokenImage(ZESTY_TOKENS[token].mainnet);
  if (!src) return <span className="inline-block rounded-full bg-[#E0E0E0]" style={{ width: size, height: size }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={ZESTY_TOKENS[token].symbol} width={size} height={size} className="rounded-full" />;
}

export function ErrorNote({ message }: { message: string }) {
  return <p role="alert" className="m-0 rounded-xl border border-[#F5B7A3] bg-[#FFF4EF] p-3 text-[14px] text-[#8F310A]">{message}</p>;
}
