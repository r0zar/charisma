/**
 * Client for prices.charisma.rocks, Charisma's price service: latest prices, changes, liquidity and OHLC history
 */

import { getHostUrl } from '@modules/discovery';

export interface PriceChange { '1h': number | null; '24h': number | null; '7d': number | null; '30d': number | null }

/** One token's latest price, as the prices API reports it */
export interface TokenPrice {
  contractId: string;
  symbol: string;
  name: string;
  image?: string;
  decimals: number;
  type?: string;
  base?: string;
  usd: number;
  sbtc: number;
  /** Percent change, e.g. 2.5 = +2.5% */
  change: PriceChange;
  liquidityUsd: number;
  /** Percent lost buying about $1 and selling straight back; null for older prices */
  roundTripLoss: number | null;
  /** True when that round trip loses over 25%, so the price is less reliable */
  thin: boolean;
  updatedAt: string;
  stale: boolean;
  /** 7 days of USD closes, oldest first (only when asked for) */
  sparkline?: number[];
}

export type PriceInterval = '5m' | '1h' | '4h' | '1d' | '1w';
export interface PriceCandle { time: number; open: number; high: number; low: number; close: number; points: number }

async function get<T>(path: string): Promise<T> {
  const url = `${getHostUrl('prices')}/api/v1${path}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Prices API ${path}: ${json?.error ?? `HTTP ${res.status}`}`);
  return json as T;
}

export const pricesClient = {
  /** Every priced token (or just `tokens`), sorted by liquidity */
  list(options: { tokens?: string[]; sparkline?: boolean } = {}) {
    const params = new URLSearchParams();
    if (options.tokens?.length) params.set('tokens', options.tokens.join(','));
    if (options.sparkline) params.set('sparkline', '1');
    return get<{ btcUsd: number | null; updatedAt: string | null; count: number; tokens: TokenPrice[] }>(`/prices?${params}`);
  },

  /** One token's latest price and 7-day sparkline */
  get(contractId: string) {
    return get<TokenPrice>(`/prices/${encodeURIComponent(contractId)}`);
  },

  /** OHLC candles, oldest first, in USD or sBTC */
  async history(contractId: string, options: { interval?: PriceInterval; quote?: 'usd' | 'sbtc'; from?: Date; to?: Date; limit?: number } = {}) {
    const params = new URLSearchParams({ interval: options.interval ?? '1h', quote: options.quote ?? 'usd' });
    if (options.from) params.set('from', String(Math.floor(options.from.getTime() / 1000)));
    if (options.to) params.set('to', String(Math.floor(options.to.getTime() / 1000)));
    if (options.limit) params.set('limit', String(options.limit));
    return (await get<{ candles: PriceCandle[] }>(`/prices/${encodeURIComponent(contractId)}/history?${params}`)).candles;
  },
};
