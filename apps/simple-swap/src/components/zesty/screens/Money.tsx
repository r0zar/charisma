'use client';

import React, { useState } from 'react';
import { ZESTY_TOKENS, type ZestyTokenKey } from '@/lib/zesty/config';
import { toUsd } from '@/lib/zesty/plan';
import { addToZesty, moveToWallet } from '@/lib/zesty/subnet';
import { CashOut } from '../CashOut';
import { Card, Chip, ErrorNote, StepTitle, TokenIcon } from '../ui';
import { formatUsd, type useZestyMoney } from '../use-zesty-money';

const KEYS = Object.keys(ZESTY_TOKENS) as ZestyTokenKey[];

const formatAmount = (key: ZestyTokenKey, micro: bigint) =>
  (Number(micro) / 10 ** ZESTY_TOKENS[key].decimals).toLocaleString('en-US', { maximumFractionDigits: key === 'sbtc' ? 8 : 2 });

/** One coin row with an action; 'add' offers 25% / 50% / All of the wallet balance. */
function CoinRow({ money, token, where, onDone, disabled }: {
  money: ReturnType<typeof useZestyMoney>;
  token: ZestyTokenKey;
  where: 'wallet' | 'zesty';
  onDone: (message: string) => void;
  disabled?: boolean;
}) {
  const [share, setShare] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const holding = money.holdings![token];
  const balance = holding[where];
  const micro = (balance * BigInt(Math.round(share * 100))) / 100n;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (where === 'wallet') await addToZesty(money.address, ZESTY_TOKENS[token], micro);
      else await moveToWallet(ZESTY_TOKENS[token], micro);
      onDone(`${where === 'wallet' ? 'Adding' : 'Moving'} ${formatUsd(toUsd(token, micro, holding.price))} of ${ZESTY_TOKENS[token].symbol}. It shows up in about a minute.`);
      await money.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-[#E5E5E5] pt-4 first:border-0 first:pt-0">
      <div className="flex items-center gap-3">
        <TokenIcon token={token} size={32} />
        <span className="flex flex-1 flex-col">
          <span className="text-[16px] font-medium">{ZESTY_TOKENS[token].symbol}</span>
          <span className="text-[13px] text-[#5C5C5C]">{formatAmount(token, balance)}</span>
        </span>
        <span className="text-[18px] font-medium">{formatUsd(toUsd(token, balance, holding.price))}</span>
      </div>
      {balance > 0n && (
        <>
          <div className="flex gap-2">
            {[0.25, 0.5, 1].map(s => <Chip key={s} active={share === s} onClick={() => setShare(s)}>{s === 1 ? 'All' : `${s * 100}%`}</Chip>)}
          </div>
          <button
            type="button"
            onClick={run}
            disabled={busy || disabled || micro === 0n}
            className={`min-h-[48px] rounded-xl text-[15px] font-medium tracking-[0.04em] ${where === 'wallet' ? 'bg-[#FC6432] text-black hover:enabled:bg-[#FF7A4D]' : 'border-2 border-black bg-white text-black hover:enabled:bg-black hover:enabled:text-white'}`}
          >
            {busy ? 'Check your wallet…' : where === 'wallet'
              ? `Add ${formatUsd(toUsd(token, micro, holding.price))} to Zesty`
              : `Move ${formatUsd(toUsd(token, micro, holding.price))} to my wallet`}
          </button>
        </>
      )}
      {error && <ErrorNote message={error} />}
    </div>
  );
}

export function Money({ money, tradeActive }: { money: ReturnType<typeof useZestyMoney>; tradeActive: boolean }) {
  const [notice, setNotice] = useState<string | null>(null);
  if (!money.holdings) return <p className="m-0 text-[15px] text-[#5C5C5C]">Loading your balances…</p>;

  return (
    <>
      <StepTitle eyebrow="Your money" title="Money">
        <p className="m-0 max-w-[640px] text-[16px] leading-relaxed text-[#3D3D3D]">
          Trades use the money in Zesty. Add some from your wallet, or move it back any time. Each move is one wallet approval with a small network fee.
        </p>
      </StepTitle>
      {notice && <p role="status" className="m-0 rounded-xl border border-[#FFD9C9] bg-[#FFF4EF] p-3 text-[14px]">{notice}</p>}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] tracking-[0.14em] text-[#5C5C5C] uppercase">In Zesty</span>
            <span className="text-[28px] font-medium">{money.zestyUsd === null ? '…' : formatUsd(money.zestyUsd)}</span>
          </div>
          {KEYS.map(key => <CoinRow key={key} money={money} token={key} where="zesty" onDone={setNotice} disabled={tradeActive} />)}
          <div className="border-t border-[#E5E5E5] pt-4"><CashOut money={money} tradeActive={tradeActive} /></div>
        </Card>
        <Card className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] tracking-[0.14em] text-[#5C5C5C] uppercase">In your wallet</span>
            <span className="text-[28px] font-medium">{money.walletUsd === null ? '…' : formatUsd(money.walletUsd)}</span>
          </div>
          {KEYS.map(key => <CoinRow key={key} money={money} token={key} where="wallet" onDone={setNotice} />)}
          {money.walletUsd === 0 && <p className="m-0 text-[14px] text-[#5C5C5C]">No sBTC or ZEST in your wallet yet.</p>}
        </Card>
      </div>
      <details className="group rounded-2xl border border-[#E5E5E5] bg-white">
        <summary className="flex min-h-[56px] list-none items-center gap-3 px-5 text-[16px] font-medium [&::-webkit-details-marker]:hidden">
          <span aria-hidden>🔒</span>
          <span className="flex-1">How safe is my money?</span>
          <span aria-hidden className="text-[#5C5C5C] transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="flex flex-col gap-2.5 px-5 pb-5 text-[15px] leading-relaxed text-[#3D3D3D]">
          <p className="m-0"><strong className="font-medium text-black">Only you can move it.</strong> Every move needs your wallet&apos;s signature, and only your wallet can make one. Not us, not anyone.</p>
          <p className="m-0"><strong className="font-medium text-black">It&apos;s as safe as your wallet.</strong> The same key that guards your wallet guards your money in Zesty.</p>
          <p className="m-0"><strong className="font-medium text-black">One new thing to know:</strong> your wallet can now sign &ldquo;Blaze&rdquo; approvals, and those move money in Zesty. Only approve the ones you started. Each one works once, and trades always pay back to you.</p>
        </div>
      </details>
    </>
  );
}
