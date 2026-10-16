import { NextResponse } from 'next/server';
import { failed } from '@/lib/http';
import { getHealth } from '@/lib/market';

/** GET /api/v1/health — 200 while prices are fresh, 503 once the last recording is over 15 minutes old */
export async function GET() {
  try {
    const health = await getHealth();
    return NextResponse.json(health, { status: health.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) {
    return failed(e);
  }
}
