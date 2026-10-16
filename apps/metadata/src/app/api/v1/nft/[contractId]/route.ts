import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { NftService } from '@/lib/nft-service';
import { CONTRACT_ID, verifyCollectionOwner } from '@/lib/nft-auth';

const TokenSchema = z.object({
    sip: z.literal(16).optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    image: z.string().url(),
    attributes: z.array(z.object({ trait_type: z.string().min(1).max(100), value: z.union([z.string().max(200), z.number()]) })).max(50).optional(),
});

const BodySchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(2000).optional(),
    /** Cover image; defaults to token 1's */
    image: z.string().url().optional(),
    /** Drop every existing token first, for a fresh upload */
    reset: z.boolean().optional(),
    tokens: z.record(z.string().regex(/^\d+$/), TokenSchema)
        .refine(tokens => Object.keys(tokens).length <= 1000, 'Send at most 1000 tokens per request')
        .optional(),
});

/**
 * POST /api/v1/nft/<contractId>: create or update a collection, and add a batch of its tokens.
 * Signed by the contract's deployer (see nft-auth). Tokens are { "<id>": SIP-016 metadata }.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ contractId: string }> }) {
    const { contractId } = await ctx.params;
    if (!CONTRACT_ID.test(contractId)) {
        return NextResponse.json({ success: false, error: `Invalid contract id: ${contractId}` }, { status: 400 });
    }

    const auth = await verifyCollectionOwner(req, contractId);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 });
    }
    const { name, description, image, reset, tokens } = parsed.data;

    try {
        const existing = await NftService.getCollection(contractId);
        if (reset) await NftService.clearTokens(contractId);
        if (tokens) await NftService.saveTokens(contractId, Object.fromEntries(Object.entries(tokens).map(([id, t]) => [id, { sip: 16, ...t }])));

        const collection = {
            contractId,
            slug: existing?.slug ?? contractId,
            name,
            description,
            image: image ?? (await NftService.getToken(contractId, '1'))?.image ?? existing?.image,
            imageBase: existing?.imageBase ?? '',
            tokenCount: await NftService.countTokens(contractId),
            // New collections mint in order through the launchpad, so their art stays hidden until minted
            hideUnminted: existing ? existing.hideUnminted : true,
            lastUpdated: new Date().toISOString(),
        };
        await NftService.saveCollection(collection);
        return NextResponse.json({ success: true, collection });
    } catch (error) {
        console.error(`Error saving NFT collection ${contractId}:`, error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
