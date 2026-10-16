import { NextResponse, type NextRequest } from 'next/server';
import { buildCandles, recentWindow } from '@/lib/candles';
import { priceTokens, savePrices } from '@/lib/recorder';

export const maxDuration = 300;

/** Every 5 minutes (vercel.json): price every token, save the run, and rebuild today's candles */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const started = Date.now();
  const at = new Date();
  const { prices, failed, listed } = await priceTokens();
  await savePrices(prices, at);
  const window = recentWindow(at);
  await buildCandles(window.from, window.to);
  const summary = { recordedAt: at.toISOString(), priced: prices.length, listed, failed, ms: Date.now() - started };
  console.log(JSON.stringify(summary));
  return NextResponse.json(summary);
}
