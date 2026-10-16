'use client';

import { ThemeToggle } from '@repo/brand/react';
import { useWallet } from './wallet';

export function SiteHeader() {
  const { address, connect, disconnect } = useWallet();
  return (
    <header className="border-b border-line bg-chrome text-on-chrome">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-3 px-4">
        <a href="https://charisma.rocks" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/charisma.png" alt="" className="h-7 w-7 rounded-full" />
          <span className="text-[17px] font-bold tracking-tight">Charisma <span className="text-chrome-accent">Recovery</span></span>
        </a>
        <div className="ml-auto flex items-center gap-1">
          {address
            ? <button type="button" onClick={disconnect} title="Disconnect" className="rounded-lg px-3 py-2 font-mono text-xs text-on-chrome-muted hover:bg-on-chrome/10 hover:text-on-chrome">{address.slice(0, 5)}…{address.slice(-4)}</button>
            : <button type="button" onClick={connect} className="rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-on-chrome-muted hover:bg-on-chrome/10 hover:text-on-chrome">Connect</button>}
          <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-chrome-muted transition-colors hover:bg-on-chrome/10 hover:text-on-chrome" />
        </div>
      </div>
    </header>
  );
}
