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
  /** Hit legs with no usable quote (no amountOut/timestamp), excluded from matching. */
  unpricedLegs: number;
  outcomes: Record<string, LegOutcome>;
  status: RunStatus;
}

// Render paths must degrade, not throw: a card on the Orders page renders these
// results directly, so missing or malformed data is classified conservatively
// instead of crashing the page.
export function legOutcome(o: LimitOrder, now: number): LegOutcome {
  const validFrom = o.validFrom ? Date.parse(o.validFrom) : 0;
  const validTo = o.validTo ? Date.parse(o.validTo) : Infinity;
  if (o.status === 'broadcasted') return 'open';
  if (o.status === 'confirmed' || o.status === 'filled') return 'hit';
  if (o.status === 'failed') return 'expired';
  if (o.status === 'cancelled') {
    // No cancelledAt means we cannot tell whether this expired or was
    // user-cancelled; take the conservative reading rather than throwing.
    if (!o.cancelledAt) return 'cancelled';
    const at = Date.parse(o.cancelledAt);
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

const quoteIso = (o: LimitOrder): string | null => o.metadata?.quote?.timestamp ?? o.confirmedAt ?? null;
const quoteTime = (o: LimitOrder) => Date.parse(quoteIso(o)!);
// A hit leg with no leg direction is corrupt data, not just an unpriced gap,
// but a render must not crash the page: treat it the same as unpriced (skip
// and count it) rather than throwing.
const isUnquoted = (o: LimitOrder) =>
  quoteIso(o) === null || o.metadata?.quote?.amountOut === undefined || (o.leg !== 'sell' && o.leg !== 'buy');
const units = (raw: string | number | undefined, decimals: number) => Number(raw ?? '0') / 10 ** decimals;

/**
 * Realized profit counts matched cycles only: each hit buy pairs with the earliest
 * unmatched hit sell before it. Both legs are valued in token B at their own quote time.
 */
export function matchRangeLegs(
  orders: LimitOrder[],
  pair: { b: string; decimalsB: number; decimalsA: number },
  usdPriceAt: (contractId: string, isoTime: string) => number | null,
  now: number = Date.now(),
): RangeMetrics {
  const outcomes: Record<string, LegOutcome> = {};
  for (const o of orders) outcomes[o.uuid] = legOutcome(o, now);

  const allHits = orders.filter((o) => outcomes[o.uuid] === 'hit');
  const unpricedLegs = allHits.filter(isUnquoted).length;
  const hits = allHits.filter((o) => !isUnquoted(o)).sort((a, b) => quoteTime(a) - quoteTime(b));
  const sells: LimitOrder[] = [];
  let realizedUsd = 0, cyclesDone = 0, unpricedPairs = 0, buysHit = 0, unmatchedBuys = 0, openPositionA = 0;

  for (const o of hits) {
    if (o.leg === 'sell') { sells.push(o); continue; }
    if (o.leg !== 'buy') continue; // corrupt/no-leg orders are filtered into unpricedLegs above
    buysHit++;
    const sell = sells.shift();
    if (!sell) { unmatchedBuys++; openPositionA += units(o.metadata?.quote?.amountOut, pair.decimalsA); continue; }
    const sellTs = quoteIso(sell)!;
    const buyTs = quoteIso(o)!;
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
    legsHit: allHits.length,
    legsEnded: ended.length,
    windowsElapsed,
    unpricedPairs,
    unpricedLegs,
    outcomes,
    status: runStatus(Object.values(outcomes)),
  };
}
