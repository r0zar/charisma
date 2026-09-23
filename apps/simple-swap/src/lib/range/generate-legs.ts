import type { RangeLegSpec, RangeSettings } from './types';

export interface PairPrices { a: number; b: number }
export interface PairDecimals { a: number; b: number }

/** Price of line at window i (0-based). */
export function lineAt(start: number, tilt: number, i: number, windows: number): number {
  return start * (1 + tilt * (windows > 1 ? i / (windows - 1) : 0));
}

/** Plain decimal string (no exponent notation) for the orders API's targetPrice validation. */
export const priceString = (n: number) => n.toFixed(18).replace(/\.?0+$/, '');

export function generateRangeLegs(
  settings: RangeSettings,
  prices: PairPrices,
  decimals: PairDecimals,
  now: number,
): RangeLegSpec[] {
  if (!(prices.a > 0) || !(prices.b > 0)) {
    throw new Error(`Cannot size range legs without a positive price for both tokens (a=${prices.a}, b=${prices.b})`);
  }
  if (settings.windows < 1) throw new Error('A range swap needs at least one window');

  const intervalMs = settings.intervalHours * 60 * 60 * 1000;
  const sellAmount = (settings.perSwapUsd / prices.a).toFixed(decimals.a);
  const buyAmount = (settings.perSwapUsd / prices.b).toFixed(decimals.b);
  const legs: RangeLegSpec[] = [];

  for (let i = 0; i < settings.windows; i++) {
    const validFrom = new Date(now + i * intervalMs).toISOString();
    const validTo = new Date(now + (i + 1) * intervalMs).toISOString();
    const common = { window: i + 1, conditionToken: settings.pair.a, baseAsset: settings.pair.b, validFrom, validTo };

    legs.push({
      ...common,
      leg: 'sell',
      position: i * 2 + 1,
      inputToken: settings.subnet.a,
      outputToken: settings.subnet.b,
      inputDecimals: decimals.a,
      amountDisplay: sellAmount,
      targetPrice: priceString(lineAt(settings.sellStart, settings.tilt, i, settings.windows)),
      direction: 'gt',
    });
    legs.push({
      ...common,
      leg: 'buy',
      position: i * 2 + 2,
      inputToken: settings.subnet.b,
      outputToken: settings.subnet.a,
      inputDecimals: decimals.b,
      amountDisplay: buyAmount,
      targetPrice: priceString(lineAt(settings.buyStart, settings.tilt, i, settings.windows)),
      direction: 'lt',
    });
  }

  return legs;
}
