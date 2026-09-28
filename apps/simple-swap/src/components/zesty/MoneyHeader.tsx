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
      className={`min-h-[40px] rounded-full px-4 text-[14px] ${view === target ? 'bg-white text-black' : 'text-[#D9D9D9] hover:text-white'}`}
    >
      {label}
    </button>
  );

  return (
    <header className="bg-black text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
        <button type="button" onClick={() => setView('trade')} className="flex items-center gap-2.5">
          <span className="h-7 w-7 rounded-full bg-[#FC6432]" />
          <span className="text-[18px] font-medium tracking-[0.12em]">ZESTY</span>
        </button>
        <nav className="order-last flex w-full items-center gap-1 md:order-none md:w-auto">
          {tab('trade', 'Trade')}
          {connected && tab('trades', 'My trades')}
          <Link href="/zesty/how-it-works" className="flex min-h-[40px] items-center gap-1.5 px-3 text-[14px] text-[#D9D9D9] hover:text-white">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[12px]">?</span>
            How it works
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-4">
          {connected && (
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="hidden gap-5 rounded-full bg-[#141414] px-4 py-2 text-left text-[12px] text-[#D9D9D9] md:flex">
              <span>Money in Zesty <strong className="ml-1 text-[15px] font-medium text-white">{money.zestyUsd === null ? '…' : formatUsd(money.zestyUsd)}</strong></span>
              <span>Wallet <strong className="ml-1 text-[15px] font-medium text-white">{money.walletUsd === null ? '…' : formatUsd(money.walletUsd)}</strong></span>
            </button>
          )}
          {connected ? (
            <span className="text-[13px] text-[#D9D9D9]">{address.slice(0, 4)}…{address.slice(-4)}</span>
          ) : (
            <button type="button" onClick={connectWallet} disabled={isConnecting} className="min-h-[44px] rounded-full bg-[#FC6432] px-4 text-[14px] font-medium text-black">
              {isConnecting ? 'Connecting…' : 'Connect wallet'}
            </button>
          )}
        </div>
      </div>
      {connected && (
        <div className="bg-[#141414] text-[13px] md:bg-transparent">
          <div className="mx-auto max-w-6xl px-6">
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full gap-2 py-3.5 text-left md:hidden">
              <span className="flex-1">Money in Zesty<br /><strong className="text-[18px] font-medium">{money.zestyUsd === null ? '…' : formatUsd(money.zestyUsd)}</strong></span>
              <span className="flex-1 text-right">In your wallet<br /><strong className="text-[18px] font-medium">{money.walletUsd === null ? '…' : formatUsd(money.walletUsd)}</strong></span>
            </button>
            {open && holdings && (
              <div className="ml-auto flex flex-col gap-2 border-t border-[#2A2A2A] py-3 md:max-w-sm md:border-0 md:pb-4">
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
        </div>
      )}
    </header>
  );
}
