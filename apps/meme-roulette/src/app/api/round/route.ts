import { after, NextRequest, NextResponse } from 'next/server';
import { kvStore } from '@/lib/roulette/store';
import { roundPayload } from '@/lib/roulette/public';
import { advanceRound, engineEnabled } from '@/lib/roulette/engine';
import { engineDeps } from '@/lib/roulette/server';

export const dynamic = 'force-dynamic';

/** The whole game state every client renders from. Cached for a second at the edge. */
export async function GET(req: NextRequest) {
    const user = req.nextUrl.searchParams.get('user') ?? undefined;
    const now = Date.now();
    const payload = await roundPayload(kvStore, now, user);
    // while someone is watching, the draw happens within a moment of the deadline instead of at the next cron
    const due = !payload.round || (payload.round.status === 'live' && now >= payload.round.endsAt) || payload.last?.status === 'drawn';
    if (due && engineEnabled()) after(() => advanceRound(engineDeps, 8000).catch(e => console.error('[roulette] advance failed:', e)));
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=2' } });
}
