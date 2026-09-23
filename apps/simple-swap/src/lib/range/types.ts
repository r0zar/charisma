import type { LimitOrder } from '@/lib/orders/types';

/** Stored on every leg as `metadata.range`. Mainnet ids feed the price service; subnet ids are what orders move. */
export interface RangeSettings {
  pair: { a: string; b: string };
  subnet: { a: string; b: string };
  sellStart: number;
  buyStart: number;
  tilt: number;
  intervalHours: number;
  windows: number;
  perSwapUsd: number;
  createdAt: string;
}

export type RangeLeg = NonNullable<LimitOrder['leg']>;

/** One order to create. `position` is 1-based across the whole run. */
export interface RangeLegSpec {
  leg: RangeLeg;
  window: number;
  position: number;
  inputToken: string;
  outputToken: string;
  inputDecimals: number;
  amountDisplay: string;
  conditionToken: string;
  baseAsset: string;
  targetPrice: string;
  direction: NonNullable<LimitOrder['direction']>;
  validFrom: string;
  validTo: string;
}
