import type { NextRequest } from 'next/server';
import { fail, failed, ok, parseTime } from '@/lib/http';
import { getHistory, INTERVALS, type Interval } from '@/lib/market';

/** How long each interval's answer stays cached at the edge, in seconds */
const CACHE: Record<Interval, number> = { '5m': 60, '1h': 120, '4h': 300, '1d': 600, '1w': 1800 };
const MAX_LIMIT = 2000;

/** GET /api/v1/prices/{contractId}/history?interval=1h&quote=usd&from=&to=&limit= — OHLC candles, oldest first */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = decodeURIComponent((await params).token);
    const q = req.nextUrl.searchParams;
    const interval = (q.get('interval') ?? '1h') as Interval;
    if (!INTERVALS.includes(interval)) return fail(400, `interval must be one of ${INTERVALS.join(', ')}`);
    const quote = q.get('quote') ?? 'usd';
    if (quote !== 'usd' && quote !== 'sbtc') return fail(400, 'quote must be usd or sbtc');
    const limit = Number(q.get('limit') ?? 500);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return fail(400, `limit must be a whole number from 1 to ${MAX_LIMIT}`);
    const candles = await getHistory(token, interval, quote, { from: parseTime('from', q.get('from')), to: parseTime('to', q.get('to')), limit });
    return ok({ token, interval, quote, count: candles.length, candles }, CACHE[interval]);
  } catch (e) {
    return failed(e);
  }
}
