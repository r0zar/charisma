export const MAX_ORDERS = 200;
export const WAITING_FOR_QUOTES = 'Waiting for route quotes';
const MIN_GAP = 0.005;

export interface PreviewInput {
  price: number;
  sell: number;
  buy: number;
  perSwapUsd: number;
  windows: number;
  /** Router cost of one cycle in USD (see `routeCostPerCycle`); null while quotes are loading. */
  routeCostUsd: number | null;
}

export interface RangePreview {
  spread: number;
  grossPerCycle: number;
  routeCostUsd: number | null;
  netPerCycle: number;
  /** Spread (as a fraction) at which a cycle nets zero after route cost. */
  breakEven: number;
  ifAll: number;
  orderCount: number;
  reasons: string[];
}

export function windowsFor(runHours: number, intervalHours: number): number {
  if (!(intervalHours > 0) || !Number.isFinite(runHours)) return 0;
  return Math.floor(runHours / intervalHours);
}

export function runwayFor(balance: number, legAmount: number): number {
  if (!(legAmount > 0) || !(balance > 0)) return 0;
  return Math.floor(balance / legAmount);
}

export function rangeProfitPreview({ price, sell, buy, perSwapUsd, windows, routeCostUsd }: PreviewInput): RangePreview {
  const spread = buy > 0 ? sell / buy - 1 : 0;
  const grossPerCycle = perSwapUsd * spread;
  // Cost is unknown while quotes load; treat it as 0 for the numbers and block the button with a reason instead.
  const cost = routeCostUsd ?? 0;
  const netPerCycle = grossPerCycle - cost;
  const breakEven = perSwapUsd > 0 ? cost / perSwapUsd : 0;
  const orderCount = windows * 2;

  const reasons: string[] = [];
  if (![price, sell, buy, windows, perSwapUsd, cost].every(Number.isFinite)) reasons.push('Fill in every field');
  if (!(perSwapUsd > 0)) reasons.push('Per swap must be more than $0');
  if (sell < price * (1 + MIN_GAP)) reasons.push('Sell line must be above current price');
  if (buy > price * (1 - MIN_GAP)) reasons.push('Buy line must be below current price');
  if (routeCostUsd === null) reasons.push(WAITING_FOR_QUOTES);
  else if (spread <= breakEven) reasons.push(`Spread is below route cost (${(breakEven * 100).toFixed(1)}%)`);
  if (windows < 1) reasons.push('Run is shorter than one window');
  if (orderCount > MAX_ORDERS) {
    reasons.push(`Too many orders (${orderCount}). Cap is ${MAX_ORDERS} in one sitting. Widen the interval or shorten the run.`);
  }

  return { spread, grossPerCycle, routeCostUsd, netPerCycle, breakEven, ifAll: netPerCycle * windows, orderCount, reasons };
}
