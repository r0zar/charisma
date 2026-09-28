'use client';

import React, { useState } from 'react';
import { ZESTY_TOKENS } from '@/lib/zesty/config';
import { swapStxIntoZesty, waitForConfirmation } from '@/lib/zesty/subnet';
import { Card, ErrorNote } from './ui';
import { formatUsd, type useZestyMoney } from './use-zesty-money';

// A little extra so price moves during the swap don't leave the trade a few cents short
const BUFFER = 1.03;
// Leave some STX behind for network fees
const MAX_STX_SHARE = 0.9;

/**
 * Shown when someone doesn't have enough sBTC or ZEST for the amount they picked.
 * With STX: swap just the shortfall into Zesty (as ZEST) right here. Without: where to get STX.
 */
export function GetStarted({ money, amountUsd, available }: { money: ReturnType<typeof useZestyMoney>; amountUsd: number; available: number }) {
  const [busy, setBusy] = useState<'wallet' | 'confirming' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { micro: stxMicro, usd: stxUsd } = money.stx;

  const shortUsd = Math.max(amountUsd - available, 0) * BUFFER;
  const swapUsd = stxUsd === null ? 0 : Math.min(shortUsd, stxUsd * MAX_STX_SHARE);
  const swapMicro = stxUsd ? BigInt(Math.floor(Number(stxMicro) * (swapUsd / stxUsd))) : 0n;
  const enough = swapUsd >= shortUsd;

  const swap = async () => {
    setError(null);
    try {
      setBusy('wallet');
      const txid = await swapStxIntoZesty(money.address, ZESTY_TOKENS.zest, swapMicro);
      setBusy('confirming');
      await waitForConfirmation(txid);
      await money.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (stxMicro === 0n) {
    return (
      <Card className="flex flex-col gap-2 border-[#FFD9C9] bg-[#FFF4EF]">
        <span className="text-[17px] font-medium">You&apos;ll need some money first</span>
        <p className="m-0 text-[15px] leading-relaxed text-[#3D3D3D]">
          Buy some STX on an exchange like Coinbase, Kraken or OKX and send it to your wallet. Come back and we&apos;ll swap it in for you.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 border-[#FFD9C9] bg-[#FFF4EF]">
      <span className="text-[17px] font-medium">Use your STX</span>
      <p className="m-0 text-[15px] leading-relaxed text-[#3D3D3D]">
        {amountUsd <= 0
          ? `You have ${stxUsd === null ? 'some' : formatUsd(stxUsd) + ' of'} STX. Type how much above and we'll swap just enough into Zesty.`
          : enough
            ? `We'll swap ${formatUsd(swapUsd)} of your STX into Zesty. It takes one approval and about a minute.`
            : `Your STX (${formatUsd(stxUsd ?? 0)}) isn't quite enough for ${formatUsd(amountUsd)}. Try a smaller amount, or swap what you can.`}
      </p>
      {amountUsd > 0 && (
        <button
          type="button"
          onClick={swap}
          disabled={!!busy || swapMicro === 0n}
          className="min-h-[52px] rounded-[14px] bg-[#FC6432] text-[15px] font-medium tracking-[0.04em] text-black hover:enabled:bg-[#FF7A4D]"
        >
          {busy === 'wallet' ? 'Check your wallet…' : busy === 'confirming' ? 'Swapping… about a minute' : `Swap ${formatUsd(swapUsd)} of STX into Zesty`}
        </button>
      )}
      {error && <ErrorNote message={error} />}
    </Card>
  );
}
