'use client';

import React, { useState } from 'react';
import { ZESTY_TOKENS, type ZestyTokenKey } from '@/lib/zesty/config';
import { toUsd } from '@/lib/zesty/plan';
import { cancelOrders, runNow } from '@/lib/zesty/orders';
import { CashOut } from '../CashOut';
import { BigButton, Card, ErrorNote, StepTitle, TokenIcon } from '../ui';
import { formatPrice, formatUsd, type useZestyMoney } from '../use-zesty-money';
import type { ZestyTrade } from '../use-zesty-trade';

const KEYS = Object.keys(ZESTY_TOKENS) as ZestyTokenKey[];

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

export function Trades({ trades, money, onChange }: { trades: ZestyTrade[]; money: ReturnType<typeof useZestyMoney>; onChange: () => void }) {
  const tradeActive = trades.some(t => t.state === 'converting' || t.state === 'waiting');
  const { holdings } = money;
  return (
    <>
      <StepTitle eyebrow="Your money" title="My trades" />
      <Card className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] text-[#3D3D3D]">Money in Zesty</span>
          <span className="text-[26px] font-medium">{money.zestyUsd === null ? '…' : formatUsd(money.zestyUsd)}</span>
        </div>
        {holdings && KEYS.map(key => (
          <div key={key} className="flex items-center gap-2 text-[14px] text-[#3D3D3D]">
            <TokenIcon token={key} size={20} />
            <span className="flex-1">{ZESTY_TOKENS[key].symbol}</span>
            <span>{formatUsd(toUsd(key, holdings[key].zesty, holdings[key].price))}</span>
          </div>
        ))}
        <CashOut money={money} tradeActive={tradeActive} />
      </Card>
      {trades.length === 0 && <p className="m-0 text-center text-[14px] text-[#5C5C5C]">No trades yet.</p>}
      {trades.map(trade => <TradeRow key={trade.strategyId} trade={trade} onChange={onChange} />)}
    </>
  );
}
