'use client';

import React from 'react';
import Link from 'next/link';
import { formatUsd, type useZestyMoney } from './use-zesty-money';

export type ZestyView = 'trade' | 'money' | 'trades';

export function MoneyHeader({ money, view, setView }: {
  money: ReturnType<typeof useZestyMoney>;
  view: ZestyView;
  setView: (view: ZestyView) => void;
}) {
  const { address, connected, isConnecting, connectWallet } = money;
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
          {connected && tab('money', 'Money')}
          {connected && tab('trades', 'My trades')}
          <Link href="/zesty/how-it-works" className="flex min-h-[40px] items-center gap-1.5 px-3 text-[14px] text-[#D9D9D9] hover:text-white">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[12px]">?</span>
            How it works
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-4">
          {connected && (
            <button type="button" onClick={() => setView('money')} className="hidden gap-5 rounded-full bg-[#141414] px-4 py-2 text-left text-[12px] text-[#D9D9D9] hover:bg-[#222] md:flex">
              <span>Money in Zesty <strong className="ml-1 text-[15px] font-medium text-white">{money.zestyUsd === null ? '…' : formatUsd(money.zestyUsd)}</strong></span>
              <span>Wallet <strong className="ml-1 text-[15px] font-medium text-white">{money.walletTotalUsd === null ? '…' : formatUsd(money.walletTotalUsd)}</strong></span>
            </button>
          )}
          {connected ? (
            <details className="relative">
              <summary className="flex min-h-[40px] list-none items-center gap-1.5 rounded-full px-3 text-[13px] text-[#D9D9D9] hover:bg-[#141414] hover:text-white [&::-webkit-details-marker]:hidden">
                {address.slice(0, 4)}…{address.slice(-4)} <span aria-hidden className="text-[10px]">▾</span>
              </summary>
              <div className="absolute right-0 z-10 mt-2 flex min-w-[180px] flex-col rounded-xl border border-[#2A2A2A] bg-[#141414] p-1.5 shadow-lg">
                <button type="button" onClick={() => navigator.clipboard.writeText(address)} className="min-h-[40px] rounded-lg px-3 text-left text-[14px] text-[#D9D9D9] hover:bg-[#222] hover:text-white">
                  Copy address
                </button>
                <button type="button" onClick={() => { money.disconnectWallet(); setView('trade'); }} className="min-h-[40px] rounded-lg px-3 text-left text-[14px] text-[#F5B7A3] hover:bg-[#222] hover:text-white">
                  Disconnect
                </button>
              </div>
            </details>
          ) : (
            <button type="button" onClick={connectWallet} disabled={isConnecting} className="min-h-[44px] rounded-full bg-[#FC6432] px-4 text-[14px] font-medium text-black">
              {isConnecting ? 'Connecting…' : 'Connect wallet'}
            </button>
          )}
        </div>
      </div>
      {connected && (
        <button type="button" onClick={() => setView('money')} className="flex w-full gap-2 bg-[#141414] px-6 py-3.5 text-left text-[13px] md:hidden">
          <span className="flex-1">Money in Zesty<br /><strong className="text-[18px] font-medium">{money.zestyUsd === null ? '…' : formatUsd(money.zestyUsd)}</strong></span>
          <span className="flex-1 text-right">In your wallet<br /><strong className="text-[18px] font-medium">{money.walletTotalUsd === null ? '…' : formatUsd(money.walletTotalUsd)}</strong></span>
        </button>
      )}
    </header>
  );
}
