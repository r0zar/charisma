'use client';

import React, { useEffect, useState } from 'react';
import type { LimitOrder } from '@/lib/orders/types';
import { ZESTY_TOKENS, type ZestyTokenKey } from '@/lib/zesty/config';
import { cancelOrders, runNow } from '@/lib/zesty/orders';
import type { Holdings } from '@/lib/zesty/plan';
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

const KEYS = Object.keys(ZESTY_TOKENS) as ZestyTokenKey[];
const tokenOf = (subnet: string) => KEYS.find(key => ZESTY_TOKENS[key].subnet === subnet)!;
const units = (key: ZestyTokenKey, micro: string) => Number(micro) / 10 ** ZESTY_TOKENS[key].decimals;

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

  const inKey = tokenOf(order.inputToken);
  const outKey = tokenOf(order.outputToken);
  const got = units(outKey, fill.amountOut!);
  const spent = units(inKey, fill.amountIn!);
  const gotUsd = got * holdings[outKey].price;
  const profit = gotUsd - trade.amountUsd;
  const pct = (profit / trade.amountUsd) * 100;
  // ZEST price the trade ran at, in dollars (sBTC side valued at today's price)
  const fillPrice = outKey === 'zest' ? (spent * holdings.sbtc.price) / got : (got * holdings.sbtc.price) / spent;
  const gain = profit >= 0;
  const amount = (key: ZestyTokenKey, n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: key === 'sbtc' ? 8 : 2 })} ${ZESTY_TOKENS[key].symbol}`;

  return (
    <>
      <div className={`flex items-baseline justify-between rounded-xl px-4 py-3 ${gain ? 'bg-[#EAF7EE]' : 'bg-[#FFF4EF]'}`}>
        <span className="text-[13px] text-[#3D3D3D]">{gain ? 'Profit' : 'Loss'}</span>
        <span className={`text-[24px] font-medium ${gain ? 'text-[#1B7A3A]' : 'text-[#B8410F]'}`}>
          {gain ? '+' : '−'}{formatUsd(Math.abs(profit))} <span className="text-[14px]">({gain ? '+' : '−'}{Math.abs(pct).toFixed(1)}%)</span>
        </span>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] text-[#3D3D3D]">
        <div><dt>You put in</dt><dd className="m-0 font-medium text-black">{formatUsd(trade.amountUsd)}</dd></div>
        <div className="text-right"><dt>You got</dt><dd className="m-0 font-medium text-black">{amount(outKey, got)}<br /><span className="font-normal text-[#5C5C5C]">worth {formatUsd(gotUsd)} now</span></dd></div>
        <div><dt>Started at</dt><dd className="m-0 font-medium text-black">{formatPrice(trade.entryPrice)}</dd></div>
        <div className="text-right"><dt>{outKey === 'zest' ? 'Bought at' : 'Sold at'}</dt><dd className="m-0 font-medium text-black">about {formatPrice(fillPrice)}</dd></div>
        <div><dt>Traded</dt><dd className="m-0 font-medium text-black">{amount(inKey, spent)}</dd></div>
        {fill.time && <div className="text-right"><dt>Finished</dt><dd className="m-0 font-medium text-black">{new Date(fill.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</dd></div>}
      </dl>
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
      {ran ? <FillDetails trade={trade} order={ran} holdings={holdings} /> : (
      <div className="flex justify-between text-[13px] text-[#3D3D3D]">
        <span>Started at<br /><strong className="font-medium text-black">{formatPrice(trade.entryPrice)}</strong></span>
        {trade.safety && <span>Safety net<br /><strong className="font-medium text-black">{formatPrice(Number(trade.safety.targetPrice))}</strong></span>}
        <span className="text-right">{up ? 'Sell at' : 'Buy at'}<br /><strong className="font-medium text-black">{formatPrice(Number(trade.target?.targetPrice ?? 0))}</strong></span>
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
