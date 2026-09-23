import type { LimitOrder } from '@/lib/orders/types';

export type LegOutcome = 'hit' | 'expired' | 'cancelled' | 'open' | 'future';
export type RunStatus = 'live' | 'completed' | 'cancelled';

export interface RangeMetrics {
  realizedUsd: number;
  cyclesDone: number;
  sellsHit: number;
  buysHit: number;
  unmatchedSells: number;
  unmatchedBuys: number;
  /** Token B held from unmatched sells, in display units. */
  openPositionB: number;
  /** Token A held from unmatched buys, in display units. */
  openPositionA: number;
  legsHit: number;
  legsEnded: number;
  windowsElapsed: number;
  unpricedPairs: number;
  outcomes: Record<string, LegOutcome>;
  status: RunStatus;
}

export function legOutcome(o: LimitOrder, now: number): LegOutcome {
  const validFrom = o.validFrom ? Date.parse(o.validFrom) : 0;
  const validTo = o.validTo ? Date.parse(o.validTo) : Infinity;
  if (o.status === 'confirmed' || o.status === 'filled') return 'hit';
  if (o.status === 'failed') return 'expired';
  if (o.status === 'cancelled') {
    const at = o.cancelledAt ? Date.parse(o.cancelledAt) : now;
    return at >= validTo ? 'expired' : 'cancelled';
  }
  if (now < validFrom) return 'future';
  if (now >= validTo) return 'expired';
  return 'open';
}

export function runStatus(outcomes: LegOutcome[]): RunStatus {
  if (outcomes.some((x) => x === 'open' || x === 'future')) return 'live';
  if (outcomes.some((x) => x === 'cancelled')) return 'cancelled';
  return 'completed';
}

const quoteTime = (o: LimitOrder) => Date.parse(o.metadata?.quote?.timestamp ?? o.confirmedAt ?? o.createdAt);
const units = (raw: string | undefined, decimals: number) => Number(raw ?? '0') / 10 ** decimals;

/**
 * Realized profit counts matched cycles only: each hit buy pairs with the earliest
 * unmatched hit sell before it. Both legs are valued in token B at their own quote time.
 */
export function matchRangeLegs(
  orders: LimitOrder[],
  pair: { b: string; decimalsB: number; decimalsA?: number },
  usdPriceAt: (contractId: string, isoTime: string) => number | null,
  now: number = Date.now(),
): RangeMetrics {
  const outcomes: Record<string, LegOutcome> = {};
  for (const o of orders) outcomes[o.uuid] = legOutcome(o, now);

  const hits = orders.filter((o) => outcomes[o.uuid] === 'hit').sort((a, b) => quoteTime(a) - quoteTime(b));
  const sells: LimitOrder[] = [];
  let realizedUsd = 0, cyclesDone = 0, unpricedPairs = 0, buysHit = 0, unmatchedBuys = 0, openPositionA = 0;

  for (const o of hits) {
    if (o.leg === 'sell') { sells.push(o); continue; }
    if (o.leg !== 'buy') continue;
    buysHit++;
    const sell = sells.shift();
    if (!sell) { unmatchedBuys++; openPositionA += units(o.metadata?.quote?.amountOut, pair.decimalsA ?? 6); continue; }
    const sellTs = sell.metadata?.quote?.timestamp ?? sell.confirmedAt ?? sell.createdAt;
    const buyTs = o.metadata?.quote?.timestamp ?? o.confirmedAt ?? o.createdAt;
    const pSell = usdPriceAt(pair.b, sellTs), pBuy = usdPriceAt(pair.b, buyTs);
    if (pSell === null || pBuy === null) { unpricedPairs++; continue; }
    realizedUsd += units(sell.metadata?.quote?.amountOut, pair.decimalsB) * pSell - units(o.amountIn, pair.decimalsB) * pBuy;
    cyclesDone++;
  }

  const openPositionB = sells.reduce((sum, s) => sum + units(s.metadata?.quote?.amountOut, pair.decimalsB), 0);
  const ended = orders.filter((o) => ['hit', 'expired', 'cancelled'].includes(outcomes[o.uuid]));
  const windowsElapsed = new Set(orders.filter((o) => o.validTo && Date.parse(o.validTo) <= now).map((o) => o.validTo)).size;

  return {
    realizedUsd,
    cyclesDone,
    sellsHit: hits.filter((o) => o.leg === 'sell').length,
    buysHit,
    unmatchedSells: sells.length,
    unmatchedBuys,
    openPositionB,
    openPositionA,
    legsHit: hits.length,
    legsEnded: ended.length,
    windowsElapsed,
    unpricedPairs,
    outcomes,
    status: runStatus(Object.values(outcomes)),
  };
}
