import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { placeBet, BetError } from '@/lib/roulette/bets';
import { betDeps } from '@/lib/roulette/server';

const Body = z.object({
    signature: z.string().regex(/^[0-9a-fA-F]{130}$/, 'signature must be 65 bytes of hex'),
    uuid: z.string(),
    user: z.string().regex(/^S[PM][0-9A-Z]{38,40}$/, 'user must be a mainnet address'),
    tokenId: z.string().min(3),
    amount: z.string(),
    subnet: z.string(),
});

/** Back a meme: a TRANSFER_TOKENS intent for subnet CHA, signed for a multihop router. */
export async function POST(req: NextRequest) {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid bet', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    try {
        const { bet, repeated, achievements } = await placeBet(betDeps, parsed.data);
        return NextResponse.json({ bet, achievements }, { status: repeated ? 200 : 201 });
    } catch (e) {
        if (e instanceof BetError) return NextResponse.json({ error: e.message }, { status: e.status });
        throw e;
    }
}
