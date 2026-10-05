import { NextRequest, NextResponse } from 'next/server';
import { kvStore } from '@/lib/roulette/store';
import { toPublicRound } from '@/lib/roulette/public';

/** Finished rounds, newest first, each with its draw: enough to list them and replay their spins. */
export async function GET(req: NextRequest) {
    const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 20)));
    const ids = await kvStore.history(limit);
    const rounds = await Promise.all(ids.map(async id => {
        const round = await kvStore.getRound(id);
        if (!round) throw new Error(`Round ${id} is in the history but has no record`);
        return toPublicRound(round, await kvStore.getBets(id));
    }));
    return NextResponse.json(
        { rounds: rounds.filter(r => r.draw) },
        { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
    );
}
