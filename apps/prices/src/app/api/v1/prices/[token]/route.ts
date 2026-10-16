import type { NextRequest } from 'next/server';
import { fail, failed, ok } from '@/lib/http';
import { getMarket } from '@/lib/market';

/** GET /api/v1/prices/{contractId} — one token's latest price, changes, liquidity and 7-day sparkline */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = decodeURIComponent((await params).token);
    if (token.length > 160) return fail(400, 'That is not a contract id. Use "<address>.<contract-name>" or ".stx".');
    const [price] = (await getMarket({ only: [token], sparkline: true })).tokens;
    if (!price) return fail(404, `No price recorded for ${token}. Check the contract id, or see /api/v1/prices for every priced token.`);
    return ok(price, 60);
  } catch (e) {
    return failed(e);
  }
}
