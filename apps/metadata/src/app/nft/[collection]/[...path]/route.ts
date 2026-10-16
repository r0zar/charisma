import { NextRequest, NextResponse } from 'next/server';
import { NftService } from '@/lib/nft-service';

// Wallets and marketplaces read NFT metadata from anywhere, so it's open to every origin
const PUBLIC = { 'Access-Control-Allow-Origin': '*' };
const SEGMENT = /^[\w.-]+$/;

/**
 * GET /nft/<collection>/<id>.json      the token's SIP-016 metadata
 * GET /nft/<collection>/<field>/<file>  one of the collection's images
 * <collection> is the contract id or the collection's slug.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ collection: string; path: string[] }> }) {
    const { collection: key, path } = await ctx.params;
    if (!path.every(p => SEGMENT.test(p))) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400, headers: PUBLIC });
    }

    const collection = await NftService.getCollection(key);
    if (!collection) {
        return NextResponse.json({ error: `Unknown collection: ${key}` }, { status: 404, headers: PUBLIC });
    }

    if (path.length === 1) {
        const tokenId = path[0].replace(/\.json$/, '');
        const token = await NftService.getToken(collection.contractId, tokenId);
        if (!token) {
            return NextResponse.json({ error: `Unknown token: ${tokenId}` }, { status: 404, headers: PUBLIC });
        }
        return NextResponse.json(token, {
            headers: { ...PUBLIC, 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
        });
    }

    const image = await fetch(`${collection.imageBase}${path.join('/')}`);
    if (!image.ok) {
        return NextResponse.json({ error: `Unknown image: ${path.join('/')}` }, { status: 404, headers: PUBLIC });
    }
    return new NextResponse(image.body, {
        headers: {
            ...PUBLIC,
            'Content-Type': image.headers.get('content-type') ?? 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });
}
