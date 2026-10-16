import { NextResponse } from 'next/server';
import { NftService } from '@/lib/nft-service';

/** GET /api/v1/nft/list: every NFT collection this service hosts */
export async function GET() {
    try {
        const collections = await NftService.listCollections();
        return NextResponse.json({ success: true, collections }, {
            headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
        });
    } catch (error) {
        console.error('Error listing NFT collections:', error);
        return NextResponse.json({ success: false, error: 'Failed to list NFT collections' }, { status: 500 });
    }
}
