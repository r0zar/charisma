'use client';

import React, { useEffect, useState } from 'react';
import { SHARE_TEXT, shareOnX } from './Share';
import { request } from '@stacks/connect';

const TIPS = [1, 5, 10];

/** Credits, the not-official note, and the tip jar that keeps the solver paying for trades. */
export function Footer() {
  const [solver, setSolver] = useState<{ address: string; stx: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/zesty/solver')
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Solver balance unavailable (${res.status})`);
        setSolver(body);
      })
      .catch(err => setError((err as Error).message));
  }, [thanks]);

  const tip = async (stx: number) => {
    if (!solver) return;
    setError(null);
    try {
      const result = await request('stx_transferStx', { recipient: solver.address, amount: String(stx * 1_000_000), memo: 'Zesty tip', network: 'mainnet' });
      if (!result?.txid) throw new Error('The tip was not sent');
      setThanks(`Thank you! ${stx} STX is on its way.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <footer className="bg-black text-[#D9D9D9]">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 md:grid-cols-2">
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed">
          <span className="flex items-center gap-2.5 text-white">
            <span className="h-6 w-6 rounded-full bg-[#FC6432]" />
            <span className="text-[16px] font-medium tracking-[0.12em]">ZESTY</span>
          </span>
          <p className="m-0">Built by <a href="https://charisma.rocks" className="text-white underline underline-offset-4">Charisma</a>. Not an official Zest project: an independent app built on open-source contracts.</p>
          <button type="button" onClick={() => shareOnX(SHARE_TEXT.zesty)} className="self-start rounded-full border border-[#3A3A3A] px-4 py-2 text-[14px] text-white hover:border-[#FC6432]">Share Zesty on X ↗</button>
          <p className="m-0">We&apos;re all about free and open source software. <a href="https://github.com/r0zar/charisma" target="_blank" rel="noopener noreferrer" className="text-white underline underline-offset-4">Read the code</a>. Hooray! 🧡</p>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl bg-[#141414] p-5 text-[14px]">
          <div className="flex items-baseline justify-between">
            <span className="font-medium text-white">Tip jar</span>
            <span>Solver balance <strong className="ml-1 font-medium text-white">{solver ? `${solver.stx.toFixed(2)} STX` : '…'}</strong></span>
          </div>
          <p className="m-0 leading-relaxed">We pay the network fee for every trade that runs while you&apos;re away. It&apos;s tiny, but if this runs dry, trades stop triggering at their price. Tippers keep it going, and we love tippers.</p>
          <div className="flex gap-2">
            {TIPS.map(stx => (
              <button key={stx} type="button" onClick={() => tip(stx)} disabled={!solver} className="min-h-[44px] flex-1 rounded-full border border-[#3A3A3A] bg-transparent text-[14px] text-[#D9D9D9] hover:enabled:border-[#FC6432] hover:enabled:text-white">
                Tip {stx} STX
              </button>
            ))}
          </div>
          {thanks && <p className="m-0 text-white">{thanks}</p>}
          {error && <p role="alert" className="m-0 text-[#F5B7A3]">{error}</p>}
        </div>
      </div>
    </footer>
  );
}
