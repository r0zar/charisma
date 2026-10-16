import { NextRequest, NextResponse } from 'next/server';
import { NftService } from '@/lib/nft-service';

const PUBLIC = { 'Access-Control-Allow-Origin': '*' };

/** GET /api/v1/nft/<contractId>/tokens?offset=0&limit=60: the collection and one page of its tokens */
export async function GET(req: NextRequest, ctx: { params: Promise<{ contractId: string }> }) {
    const { contractId } = await ctx.params;
    const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset') ?? 0));
    const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 60)));

    try {
        const collection = await NftService.getCollection(contractId);
        if (!collection) {
            return NextResponse.json({ success: false, error: `Unknown collection: ${contractId}` }, { status: 404, headers: PUBLIC });
        }
        const { total, tokens } = await NftService.listTokens(collection.contractId, offset, limit);
        return NextResponse.json({ success: true, collection, total, tokens }, {
            headers: { ...PUBLIC, 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
        });
    } catch (error) {
        console.error(`Error listing tokens for ${contractId}:`, error);
        return NextResponse.json({ success: false, error: 'Failed to list tokens' }, { status: 500, headers: PUBLIC });
    }
}
