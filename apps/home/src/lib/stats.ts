import { getHostUrl } from '@modules/discovery';

export interface PlatformStats { trades: number; traders: number; volumeUsd: number; tvlUsd: number; firstTradeAt: number; updatedAt: number }

/** Headline numbers from Swap's Analytics (read from the chain, cached 15 minutes) */
export async function getPlatformStats(): Promise<PlatformStats> {
  const url = `${getHostUrl('swap')}/api/v1/stats`;
  const res = await fetch(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Platform stats are unavailable (${url} answered ${res.status})`);
  return res.json();
}

export const count = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));
export const usd = (n: number) => n >= 10_000
  ? '$' + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
