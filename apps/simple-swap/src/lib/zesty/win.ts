import { kv } from '@vercel/kv';
import { findOrder } from '@/lib/orders/store';
import { tokenOfSubnet, toUnits } from './config';
import { inOther, type Side } from './plan';

export interface TxSwap {
  status: 'pending' | 'failed' | 'success';
  amountIn?: string;
  amountOut?: string;
  time?: string;
}

/**
 * What a router transaction swapped, read from its result.
 * The router returns one {dx, dy} per hop: the first dx is what went in, the last dy is what came out.
 */
export async function readTxSwap(txid: string): Promise<TxSwap> {
  const res = await fetch(`https://api.hiro.so/extended/v1/tx/${txid.startsWith('0x') ? txid : `0x${txid}`}`, {
    headers: process.env.HIRO_API_KEY ? { 'x-api-key': process.env.HIRO_API_KEY } : {},
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Transaction ${txid} unavailable (${res.status})`);
  const tx = (await res.json()) as { tx_status: string; burn_block_time_iso?: string; tx_result?: { repr: string } };
  if (tx.tx_status === 'pending') return { status: 'pending' };
  if (tx.tx_status !== 'success') return { status: 'failed' };

  const repr = tx.tx_result?.repr ?? '';
  const dx = [...repr.matchAll(/\(dx u(\d+)\)/g)];
  const dy = [...repr.matchAll(/\(dy u(\d+)\)/g)];
  if (!dx.length || !dy.length) throw new Error(`Transaction ${txid} has no swap result`);
  return { status: 'success', amountIn: dx[0][1], amountOut: dy[dy.length - 1][1], time: tx.burn_block_time_iso };
}

/** A shared win: fixed when first shared, so the card never changes or drifts with prices. */
export interface ZestyWin {
  side: Side;
  pct: number;
}

const winKey = (uuid: string) => `zesty:win:${uuid}`;

export const getWin = (uuid: string) => kv.get<ZestyWin>(winKey(uuid));

/** Lock in a finished target's result from its transaction. Only real wins can be shared. */
export async function createWin(uuid: string): Promise<ZestyWin> {
  const existing = await getWin(uuid);
  if (existing) return existing;

  const order = await findOrder(uuid);
  const zesty = order?.metadata?.zesty;
  if (!order || order.strategyType !== 'zesty' || zesty?.role !== 'target') throw new Error('Only a Zesty trade that hit its target can be shared');
  if (!order.txid) throw new Error('This trade has not run yet');

  const swap = await readTxSwap(order.txid);
  if (swap.status !== 'success') throw new Error('This trade is not confirmed on the blockchain yet');

  // Gain in what the trade is for (sats when betting up, ZEST when betting down), not dollars
  const inKey = tokenOfSubnet(order.inputToken);
  const start = inOther(inKey, toUnits(inKey, swap.amountIn!), zesty.entrySats);
  const pct = (toUnits(tokenOfSubnet(order.outputToken), swap.amountOut!) / start - 1) * 100;
  if (pct <= 0) throw new Error('Only winning trades can be shared');

  const win: ZestyWin = { side: zesty.side, pct: Math.round(pct * 10) / 10 };
  await kv.set(winKey(uuid), win);
  return win;
}
