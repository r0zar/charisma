'use client';

import React, { useState } from 'react';
import { cancelOrders, runNow } from '@/lib/zesty/orders';
import { BigButton, Card, ErrorNote, StepTitle } from '../ui';
import { formatPrice, formatUsd } from '../use-zesty-money';
import type { ZestyTrade } from '../use-zesty-trade';

const STATE_LABEL: Record<ZestyTrade['state'], string> = {
  converting: 'Starting',
  waiting: 'Live',
  won: 'Hit target',
  stopped: 'Safety net',
  cancelled: 'Cancelled',
};

function TradeRow({ trade, onChange }: { trade: ZestyTrade; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = trade.state === 'converting' || trade.state === 'waiting';
  const up = trade.side === 'up';

  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const open = [trade.convert, trade.target, trade.safety].filter(o => o?.status === 'open').map(o => o!);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[17px] font-medium">ZEST goes {trade.side} · {formatUsd(trade.amountUsd)}</span>
        <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${live ? 'bg-[#FC6432] text-black' : 'bg-[#F0F0F0] text-[#3D3D3D]'}`}>{STATE_LABEL[trade.state]}</span>
      </div>
      <div className="flex justify-between text-[13px] text-[#3D3D3D]">
        <span>Started at<br /><strong className="font-medium text-black">{formatPrice(trade.entryPrice)}</strong></span>
        {trade.safety && <span>Safety net<br /><strong className="font-medium text-black">{formatPrice(Number(trade.safety.targetPrice))}</strong></span>}
        <span className="text-right">{up ? 'Sell at' : 'Buy at'}<br /><strong className="font-medium text-black">{formatPrice(Number(trade.target?.targetPrice ?? 0))}</strong></span>
      </div>
      {live && (
        <div className="flex gap-3">
          {trade.state === 'waiting' && trade.target && (
            <BigButton variant="outline" disabled={busy} onClick={() => act(() => runNow(trade.target!))}>{up ? 'Sell now' : 'Buy now'}</BigButton>
          )}
          <BigButton variant="quiet" disabled={busy} onClick={() => act(() => cancelOrders(open))}>Cancel</BigButton>
        </div>
      )}
      {error && <ErrorNote message={error} />}
    </Card>
  );
}

export function Trades({ trades, onChange }: { trades: ZestyTrade[]; onChange: () => void }) {
  return (
    <>
      <StepTitle eyebrow="Your trades" title="My trades" />
      {trades.length === 0 && <p className="m-0 text-center text-[14px] text-[#5C5C5C]">No trades yet.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {trades.map(trade => <TradeRow key={trade.strategyId} trade={trade} onChange={onChange} />)}
      </div>
    </>
  );
}
