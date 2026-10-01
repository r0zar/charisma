import { NextResponse } from 'next/server';
import { getPlatformStats } from '@/lib/analytics/platform-stats';

// Public headline numbers for other Charisma sites (charisma.rocks). Same 15-minute cache as Analytics.
export const revalidate = 900;

export async function GET() {
    const s = await getPlatformStats();
    return NextResponse.json(
        { trades: s.trades, traders: s.traders, volumeUsd: s.volumeUsd, tvlUsd: s.tvlUsd, firstTradeAt: s.firstTradeAt, updatedAt: s.updatedAt },
        { headers: { 'Access-Control-Allow-Origin': '*' } },
    );
}
