import { getOrder } from '@/lib/orders/store';
import { exitSats, type Side } from './plan';

/** What a shared trade shows: the call, never amounts or the address. */
export interface SharedTrade {
  side: Side;
  entrySats: number;
  targetSats: number;
  /** Target move from entry, e.g. 0.1 for +10% */
  targetPct: number;
  state: 'live' | 'hit' | 'closed';
}

const RAN = new Set(['broadcasted', 'confirmed', 'filled']);

/** A Zesty trade by its target order id, or null when it isn't a shareable Zesty trade. */
export async function getSharedTrade(uuid: string): Promise<SharedTrade | null> {
  const order = await getOrder(uuid);
  const zesty = order?.metadata?.zesty;
  if (!order || order.strategyType !== 'zesty' || zesty?.role !== 'target' || !zesty.entrySats || !order.targetPrice) return null;
  const targetSats = exitSats(order.targetPrice);
  return {
    side: zesty.side,
    entrySats: zesty.entrySats,
    targetSats,
    targetPct: Math.abs(targetSats / zesty.entrySats - 1),
    state: order.status === 'open' ? 'live' : RAN.has(order.status) ? 'hit' : 'closed',
  };
}
