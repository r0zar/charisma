'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ZESTY_TOKENS, type ZestyTokenKey } from '@/lib/zesty/config';
import { toUsd } from '@/lib/zesty/plan';
import { CashOut } from './CashOut';
import { TokenIcon } from './ui';
import { formatUsd, type useZestyMoney } from './use-zesty-money';

const KEYS = Object.keys(ZESTY_TOKENS) as ZestyTokenKey[];

export type ZestyView = 'trade' | 'trades';

export function MoneyHeader({ money, tradeActive, view, setView }: {
  money: ReturnType<typeof useZestyMoney>;
  tradeActive: boolean;
  view: ZestyView;
  setView: (view: ZestyView) => void;
}) {
  const [open, setOpen] = useState(false);
  const { holdings, address, connected, isConnecting, connectWallet } = money;
  const tab = (target: ZestyView, label: string) => (
    <button
      type="button"
      onClick={() => setView(target)}
      aria-current={view === target ? 'page' : undefined}
      className={`min-h-[44px] rounded-full px-4 text-[14px] ${view === target ? 'bg-white text-black' : 'text-[#D9D9D9]'}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <header className="flex items-center justify-between bg-black px-6 py-4 text-white">
        <button type="button" onClick={() => setView('trade')} className="flex items-center gap-2.5">
          <span className="h-7 w-7 rounded-full bg-[#FC6432]" />
          <span className="text-[18px] font-medium tracking-[0.12em]">ZESTY</span>
        </button>
        {connected ? (
          <span className="text-[13px] text-[#D9D9D9]">{address.slice(0, 4)}…{address.slice(-4)}</span>
        ) : (
          <button type="button" onClick={connectWallet} disabled={isConnecting} className="min-h-[44px] rounded-full bg-[#FC6432] px-4 text-[14px] font-medium text-black">
            {isConnecting ? 'Connecting…' : 'Connect wallet'}
          </button>
        )}
      </header>
      <nav className="flex items-center gap-1 bg-black px-4 pb-3">
        {tab('trade', 'Trade')}
        {connected && tab('trades', 'My trades')}
        <Link href="/zesty/how-it-works" className="ml-auto flex min-h-[44px] items-center gap-1.5 px-2 text-[14px] text-[#D9D9D9] underline-offset-4 hover:underline">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#D9D9D9] text-[12px]">?</span>
          How it works
        </Link>
      </nav>
      {connected && (
        <div className="bg-[#141414] px-6 py-3.5 text-[13px] text-white">
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full gap-2 text-left">
            <span className="flex-1">Money in Zesty<br /><strong className="text-[18px] font-medium">{money.zestyUsd === null ? '…' : formatUsd(money.zestyUsd)}</strong></span>
            <span className="flex-1 text-right">In your wallet<br /><strong className="text-[18px] font-medium">{money.walletUsd === null ? '…' : formatUsd(money.walletUsd)}</strong></span>
          </button>
          {open && holdings && (
            <div className="mt-3 flex flex-col gap-2 border-t border-[#2A2A2A] pt-3">
              {KEYS.map(key => (
                <div key={key} className="flex items-center gap-2 text-[#D9D9D9]">
                  <TokenIcon token={key} size={18} />
                  <span className="flex-1">{ZESTY_TOKENS[key].symbol}</span>
                  <span>{formatUsd(toUsd(key, holdings[key].zesty, holdings[key].price))} in Zesty</span>
                </div>
              ))}
              <div className="rounded-xl bg-white p-3 text-black">
                <CashOut money={money} tradeActive={tradeActive} />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
