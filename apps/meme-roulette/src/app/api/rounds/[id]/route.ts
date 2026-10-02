import { NextRequest, NextResponse } from 'next/server';
import { kvStore } from '@/lib/roulette/store';
import { toPublicBet, toPublicRound } from '@/lib/roulette/public';

/** A finished round with everything needed to check its draw: the seed, the block, the slices and every bet. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const round = await kvStore.getRound(id);
    if (!round) return NextResponse.json({ error: `No round ${id}` }, { status: 404 });
    const bets = await kvStore.getBets(id);
    return NextResponse.json(
        { round: toPublicRound(round, bets), bets: bets.sort((a, b) => a.placedAt - b.placedAt).map(toPublicBet) },
        { headers: { 'Cache-Control': round.status === 'settled' || round.status === 'void' ? 'public, s-maxage=3600' : 'public, s-maxage=2' } },
    );
}
