'use client';

import React, { useState } from 'react';
import { ZESTY_TOKENS, type ZestyTokenKey } from '@/lib/zesty/config';
import { moveToWallet } from '@/lib/zesty/subnet';
import { BigButton, ErrorNote } from './ui';
import type { useZestyMoney } from './use-zesty-money';

const KEYS = Object.keys(ZESTY_TOKENS) as ZestyTokenKey[];

/** Move everything in Zesty back to the wallet: one wallet call per coin held. */
export function CashOut({ money, tradeActive }: { money: ReturnType<typeof useZestyMoney>; tradeActive: boolean }) {
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { holdings } = money;
  const hasZestyMoney = !!holdings && KEYS.some(key => holdings[key].zesty > 0n);

  const cashOut = async () => {
    if (!holdings) return;
    setMoving(true);
    setError(null);
    try {
      for (const key of KEYS) {
        if (holdings[key].zesty > 0n) await moveToWallet(ZESTY_TOKENS[key], holdings[key].zesty);
      }
      await money.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setMoving(false);
    }
  };

  if (tradeActive) {
    return <p className="m-0 text-[14px] text-[#5C5C5C]">A live trade is using this money. Cancel it to move money out.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <BigButton variant="outline" onClick={cashOut} disabled={!hasZestyMoney || moving}>
        {moving ? 'Check your wallet…' : 'Move money to my wallet'}
      </BigButton>
      {error && <ErrorNote message={error} />}
    </div>
  );
}
