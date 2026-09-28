import { NextResponse } from 'next/server';

// ZEST priced in BTC (≈ sBTC), hourly. Our own history only starts when ZEST became routable, so this uses CoinGecko.
const SOURCE = 'https://api.coingecko.com/api/v3/coins/zest-protocol/market_chart?vs_currency=btc';

export async function GET(req: Request) {
  const days = new URL(req.url).searchParams.get('days') === '30' ? 30 : 7;
  const res = await fetch(`${SOURCE}&days=${days}`, { next: { revalidate: 600 } });
  if (!res.ok) {
    return NextResponse.json({ error: `ZEST price history unavailable (CoinGecko ${res.status})` }, { status: 502 });
  }
  const { prices } = (await res.json()) as { prices: [number, number][] };
  // Sats per ZEST reads better than 0.0000022 BTC
  const points = prices.map(([ms, btc]) => ({ time: Math.floor(ms / 1000), sats: btc * 1e8 }));
  return NextResponse.json({ points }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } });
}
