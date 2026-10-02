import { NextRequest, NextResponse } from 'next/server';
import { advanceRound, engineEnabled } from '@/lib/roulette/engine';
import { engineDeps } from '@/lib/roulette/server';

export const maxDuration = 60;

/** Vercel cron, every minute: draw what's due and settle what's drawn. */
export async function GET(req: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 500 });
    if (req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!engineEnabled()) return NextResponse.json({ error: 'The engine is off here (ROULETTE_ENGINE is not "on")' }, { status: 503 });
    return NextResponse.json(await advanceRound(engineDeps, 50_000));
}
