import { NextRequest, NextResponse } from 'next/server';
import { PriceSeriesStorage } from '@services/prices';
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

export async function GET(request: NextRequest) {
    if (!BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN not configured' }, { status: 500 });
    }

    try {
        // List all snapshot files
        const blobs = await list({
            prefix: 'snapshots/',
            token: BLOB_READ_WRITE_TOKEN,
            limit: 1000
        });
        // Sort by timestamp descending
        const sorted = blobs.blobs
            .map(blob => ({ ...blob, timestamp: extractTimestampFromPath(blob.pathname) }))
            .filter(blob => blob.timestamp)
            .sort((a, b) => (b.timestamp! - a.timestamp!));
        // Take the latest 50
        const latest = sorted.slice(0, 50);
        // Fetch and parse each snapshot file
        const storage = new PriceSeriesStorage(BLOB_READ_WRITE_TOKEN);
        const snapshots: any[] = [];
        for (const blob of latest) {
            try {
                const response = await fetch(blob.url);
                if (!response.ok) continue;
                const data = await response.json();
                snapshots.push({
                    id: String(data.timestamp),
                    timestamp: data.timestamp,
                    totalTokens: data.metadata?.totalTokens ?? 0,
                    successfulPrices: data.prices?.length ?? 0,
                    failedPrices: (data.metadata?.totalTokens ?? 0) - (data.prices?.length ?? 0),
                    engineStats: data.metadata?.engineStats || { oracle: 0, market: 0, intrinsic: 0, hybrid: 0 },
                    calculationTimeMs: data.metadata?.calculationTime ?? 0,
                    arbitrageOpportunities: data.metadata?.arbitrageOpportunities ?? 0,
                    btcPrice: data.metadata?.btcPrice,
                    storageSize: blob.size
                });
            } catch { }
        }
        return NextResponse.json({ snapshots });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to fetch snapshots' }, { status: 500 });
    }
} 