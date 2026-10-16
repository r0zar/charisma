import type { NextRequest } from 'next/server';
import { failed, ok } from '@/lib/http';
import { getMarket } from '@/lib/market';

/** GET /api/v1/prices?tokens=a,b&sparkline=1 — every token's latest price, changes and liquidity */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const only = params.get('tokens')?.split(',').map(t => t.trim()).filter(Boolean);
    const sparkline = ['1', 'true'].includes(params.get('sparkline') ?? '');
    const market = await getMarket({ only, sparkline });
    const updatedAt = market.tokens.reduce((latest, t) => (t.updatedAt > latest ? t.updatedAt : latest), '');
    return ok({ btcUsd: market.btcUsd, updatedAt: updatedAt || null, count: market.tokens.length, tokens: market.tokens }, 60);
  } catch (e) {
    return failed(e);
  }
}
