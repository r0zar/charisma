import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { BetError } from '@/lib/roulette/bets';
import { upgradeToV2 } from '@/lib/roulette/upgrade';
import { engineEnabled } from '@/lib/roulette/engine';
import { upgradeDeps } from '@/lib/roulette/server';

const Body = z.object({
    signature: z.string().regex(/^[0-9a-fA-F]{130}$/, 'signature must be 65 bytes of hex'),
    uuid: z.string(),
    user: z.string().regex(/^S[PM][0-9A-Z]{38,40}$/, 'user must be a mainnet address'),
    amount: z.string(),
});

/** Move free Blaze v1 CHA into Blaze v2: a signed v1 TRANSFER_TOKENS intent for x-multihop-v2, broadcast by the solver. */
export async function POST(req: NextRequest) {
    // like the engine, only production broadcasts: a local server must never spend the solver's STX
    if (!engineEnabled()) return NextResponse.json({ error: 'Upgrades run on the live site only' }, { status: 503 });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid upgrade', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    try {
        return NextResponse.json(await upgradeToV2(upgradeDeps, parsed.data), { status: 201 });
    } catch (e) {
        if (e instanceof BetError) return NextResponse.json({ error: e.message }, { status: e.status });
        throw e;
    }
}
