'use client';

import React, { useEffect, useState } from 'react';
import type { LimitOrder } from '@/lib/orders/types';
import { tokenOfSubnet, toUnits } from '@/lib/zesty/config';
import { cancelOrders, runNow } from '@/lib/zesty/orders';
import { exitSats, type Holdings } from '@/lib/zesty/plan';
import { BigButton, Card, ErrorNote, SatsPrice, StepTitle } from '../ui';
import { formatAmount, formatUsd } from '../use-zesty-money';
import type { ZestyTrade } from '../use-zesty-trade';
import { LiveProfit, ProfitBanner } from './Profit';

const STATE_LABEL: Record<ZestyTrade['state'], string> = {
  converting: 'Starting',
  waiting: 'Live',
  won: 'Hit target',
  stopped: 'Safety net',
  cancelled: 'Cancelled',
};

/** Lock in the win on the server, then open a ready-made post on X. */
async function shareWin(order: LimitOrder) {
  // Open the tab now, while the tap still counts, so popup blockers allow it
  const tab = window.open('', '_blank');
  const res = await fetch(`/api/v1/zesty/win/${order.uuid}`, { method: 'POST' });
  const body = await res.json();
  if (!res.ok) {
    tab?.close();
    throw new Error(body.error ?? `Could not share this trade (${res.status})`);
  }
  const text = `I called it. ZEST went ${body.side}: +${body.pct.toFixed(1)}% on Zesty 🍋`;
  const url = `https://zesty.charisma.rocks/win/${order.uuid}`;
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  if (tab) tab.location.href = intent;
  else window.location.href = intent;
}

interface Fill { status: 'pending' | 'failed' | 'success'; amountIn?: string; amountOut?: string; time?: string }

/** What a finished trade delivered: profit, amounts, fill price, and the transaction on the blockchain. */
function FillDetails({ trade, order, holdings }: { trade: ZestyTrade; order: LimitOrder; holdings: Holdings | null }) {
  const [fill, setFill] = useState<Fill | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!order.txid) return;
    fetch(`/api/v1/zesty/fill?txid=${order.txid}`)
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Trade details unavailable (${res.status})`);
        setFill(body);
      })
      .catch(err => setError((err as Error).message));
  }, [order.txid]);

  const explorer = order.txid && (
    <a href={`https://explorer.hiro.so/txid/${order.txid.startsWith('0x') ? order.txid : `0x${order.txid}`}?chain=mainnet`} target="_blank" rel="noopener noreferrer" className="self-start text-[14px] text-[#B8410F] underline underline-offset-4 hover:text-black">
      View on the blockchain ↗
    </a>
  );
  if (error) return <><ErrorNote message={error} />{explorer}</>;
  if (!fill || !holdings) return <p className="m-0 text-[14px] text-[#5C5C5C]">Loading the result…</p>;
  if (fill.status !== 'success') {
    return <><p className="m-0 text-[14px] text-[#5C5C5C]">{fill.status === 'pending' ? 'Confirming on the blockchain…' : 'This trade did not go through. Your money stayed in Zesty.'}</p>{explorer}</>;
  }

  const inKey = tokenOfSubnet(order.inputToken);
  const outKey = tokenOfSubnet(order.outputToken);
  const got = toUnits(outKey, fill.amountOut!);
  const spent = toUnits(inKey, fill.amountIn!);
  const gotUsd = got * holdings[outKey].price;
  const profit = gotUsd - trade.amountUsd;
  // Sats per ZEST the trade ran at
  const fillSats = outKey === 'zest' ? (spent * 1e8) / got : (got * 1e8) / spent;
  const gain = profit >= 0;

  return (
    <>
      <ProfitBanner profit={profit} amountUsd={trade.amountUsd} />
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] text-[#3D3D3D]">
        <div><dt>You put in</dt><dd className="m-0 font-medium text-black">{formatAmount(inKey, spent)}<br /><span className="font-normal text-[#5C5C5C]">{formatUsd(trade.amountUsd)}</span></dd></div>
        <div className="text-right"><dt>You got</dt><dd className="m-0 font-medium text-black">{formatAmount(outKey, got)}<br /><span className="font-normal text-[#5C5C5C]">worth {formatUsd(gotUsd)} now</span></dd></div>
        <div><dt>Started at</dt><dd className="m-0 font-medium text-black"><SatsPrice sats={trade.entrySats} /></dd></div>
        <div className="text-right"><dt>{outKey === 'zest' ? 'Bought at' : 'Sold at'}</dt><dd className="m-0 font-medium text-black">about <SatsPrice sats={fillSats} /></dd></div>
        {fill.time && <div className="text-right"><dt>Finished</dt><dd className="m-0 font-medium text-black">{new Date(fill.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</dd></div>}
      </dl>
      {trade.state === 'won' && gain && (
        <BigButton onClick={() => shareWin(order).catch(err => setError((err as Error).message))}>Share my win 🏆</BigButton>
      )}
      {explorer}
    </>
  );
}

function TradeRow({ trade, holdings, onChange }: { trade: ZestyTrade; holdings: Holdings | null; onChange: () => void }) {
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

  const ran = trade.state === 'won' ? trade.target : trade.state === 'stopped' ? trade.safety : undefined;
  const open = [trade.convert, trade.target, trade.safety].filter(o => o?.status === 'open').map(o => o!);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[17px] font-medium">ZEST goes {trade.side} · {formatUsd(trade.amountUsd)}</span>
        <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${live ? 'bg-[#FC6432] text-black' : 'bg-[#F0F0F0] text-[#3D3D3D]'}`}>{STATE_LABEL[trade.state]}</span>
      </div>
      {!ran && <LiveProfit trade={trade} holdings={holdings} />}
      {ran ? <FillDetails trade={trade} order={ran} holdings={holdings} /> : (
      <div className="flex justify-between text-[13px] text-[#3D3D3D]">
        <span>Started at<br /><strong className="font-medium text-black"><SatsPrice sats={trade.entrySats} /></strong></span>
        {trade.safety && <span>Safety net<br /><strong className="font-medium text-black"><SatsPrice sats={exitSats(trade.safety.targetPrice!)} /></strong></span>}
        <span className="text-right">{up ? 'Sell at' : 'Buy at'}<br /><strong className="font-medium text-black"><SatsPrice sats={exitSats(trade.target?.targetPrice ?? '0')} /></strong></span>
      </div>
      )}
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

export function Trades({ trades, holdings, onChange }: { trades: ZestyTrade[]; holdings: Holdings | null; onChange: () => void }) {
  return (
    <>
      <StepTitle eyebrow="Your trades" title="My trades" />
      {trades.length === 0 && <p className="m-0 text-center text-[14px] text-[#5C5C5C]">No trades yet.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {trades.map(trade => <TradeRow key={trade.strategyId} trade={trade} holdings={holdings} onChange={onChange} />)}
      </div>
    </>
  );
}
