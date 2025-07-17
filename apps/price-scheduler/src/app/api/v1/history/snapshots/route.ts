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
        // Get timeRange parameter from query
        const { searchParams } = new URL(request.url);
        const timeRange = searchParams.get('timeRange') || '24h';
        
        // Calculate time cutoff based on timeRange
        const now = Date.now();
        let cutoffTime = 0;
        
        switch (timeRange) {
            case '1h':
                cutoffTime = now - (1 * 60 * 60 * 1000); // 1 hour ago
                break;
            case '24h':
                cutoffTime = now - (24 * 60 * 60 * 1000); // 24 hours ago
                break;
            case '7d':
                cutoffTime = now - (7 * 24 * 60 * 60 * 1000); // 7 days ago
                break;
            case '30d':
                cutoffTime = now - (30 * 24 * 60 * 60 * 1000); // 30 days ago
                break;
            case 'all':
            default:
                cutoffTime = 0; // No cutoff for 'all'
                break;
        }

        // List all snapshot files
        const blobs = await list({
            prefix: 'snapshots/',
            token: BLOB_READ_WRITE_TOKEN,
            limit: 1000
        });
        
        // Sort by timestamp descending and apply time filter
        const sorted = blobs.blobs
            .map(blob => ({ ...blob, timestamp: extractTimestampFromPath(blob.pathname) }))
            .filter(blob => blob.timestamp && blob.timestamp >= cutoffTime)
            .sort((a, b) => (b.timestamp! - a.timestamp!));
        
        // Take the latest 100 (increased limit for better time range coverage)
        const latest = sorted.slice(0, 100);
        // Fetch and parse each snapshot file
        const storage = new PriceSeriesStorage(BLOB_READ_WRITE_TOKEN);
        const snapshots: any[] = [];
        for (const blob of latest) {
            try {
                const response = await fetch(blob.url);
                if (!response.ok) continue;
                const data = await response.json();
                const roundedTimestamp = blob.timestamp;
                snapshots.push({
                    id: String(roundedTimestamp), // Use rounded timestamp as id
                    timestamp: roundedTimestamp,  // Use rounded timestamp for display
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
        return NextResponse.json({ 
            snapshots,
            metadata: {
                timeRange,
                cutoffTime,
                totalFound: snapshots.length,
                processedAt: now
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to fetch snapshots' }, { status: 500 });
    }
}