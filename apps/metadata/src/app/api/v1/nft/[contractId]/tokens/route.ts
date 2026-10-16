import { NextRequest, NextResponse } from 'next/server';
import { NftService } from '@/lib/nft-service';

const PUBLIC = { 'Access-Control-Allow-Origin': '*' };

/**
 * GET /api/v1/nft/<contractId>/tokens?offset=0&limit=60&sort=id&trait=Type:Buckler&trait=Realm:Nirvana
 * The collection, one page of its tokens that have every given trait, and each trait value's count.
 * sort is 'id', 'name', or a trait type.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ contractId: string }> }) {
    const { contractId } = await ctx.params;
    const params = req.nextUrl.searchParams;
    const offset = Math.max(0, Number(params.get('offset') ?? 0));
    const limit = Math.min(200, Math.max(1, Number(params.get('limit') ?? 60)));
    const sort = params.get('sort') ?? 'id';
    const traits = Object.fromEntries(params.getAll('trait').map(t => {
        const split = t.indexOf(':');
        return [t.slice(0, split), t.slice(split + 1)];
    }));

    try {
        const collection = await NftService.getCollection(contractId);
        if (!collection) {
            return NextResponse.json({ success: false, error: `Unknown collection: ${contractId}` }, { status: 404, headers: PUBLIC });
        }
        const result = await NftService.listTokens(collection.contractId, { offset, limit, traits, sort });
        return NextResponse.json({ success: true, collection, ...result }, {
            headers: { ...PUBLIC, 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
        });
    } catch (error) {
        console.error(`Error listing tokens for ${contractId}:`, error);
        return NextResponse.json({ success: false, error: 'Failed to list tokens' }, { status: 500, headers: PUBLIC });
    }
}
