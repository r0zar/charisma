import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function extractTimestampFromPath(path: string): number | null {
    // Path: snapshots/YYYY/MM/DD/HH-MM.json
    const parts = path.split('/');
    if (parts.length !== 5) return null;
    const [_, year, month, day, timeFile] = parts;
    const [hour, minute] = timeFile.replace('.json', '').split('-');
    const date = new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute)
    ));
    return date.getTime();
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    if (!BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN not configured' }, { status: 500 });
    }
    const { id } = await context.params;
    const targetTimestamp = Number(id);
    if (!targetTimestamp) {
        return NextResponse.json({ error: 'Invalid snapshot id' }, { status: 400 });
    }
    try {
        // List all snapshot files
        const blobs = await list({
            prefix: 'snapshots/',
            token: BLOB_READ_WRITE_TOKEN,
            limit: 1000
        });
        // Debug logging
        const availableTimestamps = blobs.blobs.map(blob => extractTimestampFromPath(blob.pathname));
        console.log('Available snapshot timestamps:', availableTimestamps);
        console.log('Requested snapshot id:', targetTimestamp);
        // Find the blob with matching timestamp
        const match = blobs.blobs.find(blob => extractTimestampFromPath(blob.pathname) === targetTimestamp);
        if (!match) {
            return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
        }
        const response = await fetch(match.url);
        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch snapshot file' }, { status: 500 });
        }
        const data = await response.json();
        // Map to frontend format
        const snapshot = {
            id: String(data.timestamp),
            timestamp: data.timestamp,
            totalTokens: data.metadata?.totalTokens ?? 0,
            successfulPrices: data.prices?.length ?? 0,
            failedPrices: (data.metadata?.totalTokens ?? 0) - (data.prices?.length ?? 0),
            engineStats: data.metadata?.engineStats || { oracle: 0, market: 0, intrinsic: 0, hybrid: 0 },
            calculationTimeMs: data.metadata?.calculationTime ?? 0,
            arbitrageOpportunities: data.metadata?.arbitrageOpportunities ?? 0,
            btcPrice: data.metadata?.btcPrice,
            storageSize: match.size
        };
        const prices = (data.prices || []).map((p: any) => ({
            tokenId: p.tokenId,
            symbol: p.symbol,
            usdPrice: p.usdPrice,
            sbtcRatio: p.sbtcRatio,
            source: p.source,
            reliability: p.reliability,
            lastUpdated: data.timestamp
        }));
        return NextResponse.json({ snapshot, prices });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to fetch snapshot' }, { status: 500 });
    }
} 