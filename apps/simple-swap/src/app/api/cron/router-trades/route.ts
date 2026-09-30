import { NextRequest, NextResponse } from 'next/server';
import { syncRouterTrades } from '@/lib/analytics/router-trades';

export const maxDuration = 60;

/** Pull new router trades from the chain for Analytics (and older history until it's all read) */
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        return NextResponse.json({ synced: await syncRouterTrades(45_000) });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
