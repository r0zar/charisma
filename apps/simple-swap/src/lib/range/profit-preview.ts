export const SLIPPAGE = 0.01;
export const MAX_ORDERS = 200;
const MIN_GAP = 0.005;

export interface PreviewInput {
  price: number;
  sell: number;
  buy: number;
  perSwapUsd: number;
  windows: number;
}

export interface RangePreview {
  spread: number;
  grossPerCycle: number;
  slippageCost: number;
  netPerCycle: number;
  breakEven: number;
  ifAll: number;
  orderCount: number;
  reasons: string[];
}

export function windowsFor(runHours: number, intervalHours: number): number {
  if (intervalHours <= 0) return 0;
  return Math.floor(runHours / intervalHours);
}

export function runwayFor(balance: number, legAmount: number): number {
  if (!(legAmount > 0) || !(balance > 0)) return 0;
  return Math.floor(balance / legAmount);
}

export function rangeProfitPreview({ price, sell, buy, perSwapUsd, windows }: PreviewInput): RangePreview {
  const spread = buy > 0 ? sell / buy - 1 : 0;
  const grossPerCycle = perSwapUsd * spread;
  const slippageCost = 2 * SLIPPAGE * perSwapUsd;
  const netPerCycle = grossPerCycle - slippageCost;
  const breakEven = 2 * SLIPPAGE;
  const orderCount = windows * 2;

  const reasons: string[] = [];
  if (!(perSwapUsd > 0)) reasons.push('Per swap must be more than $0');
  if (sell <= price * (1 + MIN_GAP)) reasons.push('Sell line must be above current price');
  if (buy >= price * (1 - MIN_GAP)) reasons.push('Buy line must be below current price');
  if (spread <= breakEven) reasons.push('Spread is below break-even (2%)');
  if (windows < 1) reasons.push('Run is shorter than one window');
  if (orderCount > MAX_ORDERS) {
    reasons.push(`Too many orders (${orderCount}). Cap is ${MAX_ORDERS} in one sitting. Widen the interval or shorten the run.`);
  }

  return { spread, grossPerCycle, slippageCost, netPerCycle, breakEven, ifAll: netPerCycle * windows, orderCount, reasons };
}
