'use client';

import { useEffect, useState } from 'react';
import type { LimitOrder } from '@/lib/orders/types';
import type { ZestyRole } from '@/lib/zesty/orders';
import type { Side } from '@/lib/zesty/plan';

export interface ZestyTrade {
  strategyId: string;
  side: Side;
  entrySats: number;
  amountUsd: number;
  convert?: LimitOrder;
  target?: LimitOrder;
  safety?: LimitOrder;
  /** waiting: exits are open · won: the target ran · stopped: the safety net ran · cancelled: user cancelled */
  state: 'converting' | 'waiting' | 'won' | 'stopped' | 'cancelled';
}

const RAN = new Set<LimitOrder['status']>(['broadcasted', 'confirmed', 'filled']);

function toTrade(strategyId: string, orders: LimitOrder[]): ZestyTrade {
  const byRole = (role: ZestyRole) => orders.find(o => o.metadata?.zesty?.role === role);
  const { side, entrySats, amountUsd } = orders[0].metadata!.zesty;
  const convert = byRole('convert');
  const target = byRole('target');
  const safety = byRole('safety');
  const state =
    target && RAN.has(target.status) ? 'won'
    : safety && RAN.has(safety.status) ? 'stopped'
    : convert?.status === 'open' ? 'converting'
    : target?.status === 'open' ? 'waiting'
    : 'cancelled';
  return { strategyId, side, entrySats, amountUsd, convert, target, safety, state };
}

/** The user's Zesty trades, newest first, refreshed every 15 seconds. */
export function useZestyTrade(address: string) {
  const [trades, setTrades] = useState<ZestyTrade[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!address) {
      setTrades([]);
      return;
    }
    let active = true;
    const load = async () => {
      const res = await fetch(`/api/v1/orders?owner=${address}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Could not load your trades (${res.status})`);
      // Trades from before prices were in sats have no entrySats; Zesty only shows sats trades
      const orders = ((await res.json()).data as LimitOrder[]).filter(o => o.strategyType === 'zesty' && o.strategyId && o.metadata?.zesty?.entrySats);
      const ids = [...new Set(orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(o => o.strategyId!))];
      if (active) setTrades(ids.map(id => toTrade(id, orders.filter(o => o.strategyId === id))));
    };
    load().catch(err => console.error('[Zesty] loading trade failed:', err));
    const timer = setInterval(() => load().catch(err => console.error('[Zesty] loading trade failed:', err)), 15000);
    return () => { active = false; clearInterval(timer); };
  }, [address, version]);

  return { trades, trade: trades[0] ?? null, reload: () => setVersion(v => v + 1) };
}
