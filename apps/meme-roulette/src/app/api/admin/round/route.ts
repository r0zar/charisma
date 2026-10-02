import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { kvStore } from '@/lib/roulette/store';
import { roundPayload, toPublicBet } from '@/lib/roulette/public';
import { rescheduleRound, voidRound } from '@/lib/roulette/engine';
import { engineDeps } from '@/lib/roulette/server';
import { requireAdmin } from '@/lib/roulette/admin-auth';

export const dynamic = 'force-dynamic';

const MINUTE = 60_000;
const Action = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('config'),
        roundMs: z.number().int().min(2 * MINUTE),
        lockMs: z.number().int().min(30_000),
        intermissionMs: z.number().int().min(15_000).max(10 * MINUTE),
    }),
    z.object({ action: z.literal('reschedule'), endsAt: z.number().int() }),
    z.object({ action: z.literal('void') }),
]);

/** The game state plus recent history, for the admin page. */
export async function GET() {
    const [payload, history] = await Promise.all([roundPayload(kvStore, Date.now()), kvStore.history(20)]);
    const bets = payload.round ? (await kvStore.getBets(payload.round.id)).sort((a, b) => b.placedAt - a.placedAt).map(toPublicBet) : [];
    return NextResponse.json({ ...payload, history, bets });
}

/** Change round timing (it applies from the next round), move the live round's draw time, or void the live round. */
export async function POST(req: NextRequest) {
    const denied = await requireAdmin(req);
    if (denied) return denied;
    const parsed = Action.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid admin action', details: parsed.error.flatten() }, { status: 400 });
    try {
        const a = parsed.data;
        if (a.action === 'config') {
            const { action: _action, ...config } = a;
            if (config.lockMs >= config.roundMs) return NextResponse.json({ error: 'The lock must be shorter than the round' }, { status: 400 });
            await kvStore.setConfig(config);
            return NextResponse.json({ config });
        }
        const round = a.action === 'void' ? await voidRound(engineDeps) : await rescheduleRound(engineDeps, a.endsAt);
        return NextResponse.json({ round: { id: round.id, status: round.status, opensAt: round.opensAt, locksAt: round.locksAt, endsAt: round.endsAt } });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 });
    }
}
