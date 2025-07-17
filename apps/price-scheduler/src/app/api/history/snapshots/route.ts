import { NextRequest, NextResponse } from 'next/server';
import { PriceSeriesStorage } from '@services/prices';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

export async function GET(request: NextRequest) {
    if (!BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN not configured' }, { status: 500 });
    }

    try {
        const storage = new PriceSeriesStorage(BLOB_READ_WRITE_TOKEN);
        // For now, just get the latest 50 snapshots
        const snapshots = await storage.getRecentSnapshots(50);
        // Map to frontend format
        const result = (snapshots || []).map((snap: any) => ({
            id: String(snap.timestamp),
            timestamp: snap.timestamp,
            totalTokens: snap.metadata?.totalTokens ?? 0,
            successfulPrices: snap.prices?.size ?? 0,
            failedPrices: (snap.metadata?.totalTokens ?? 0) - (snap.prices?.size ?? 0),
            engineStats: snap.metadata?.engineStats || { oracle: 0, market: 0, intrinsic: 0, hybrid: 0 },
            calculationTimeMs: snap.metadata?.calculationTime ?? 0,
            arbitrageOpportunities: snap.metadata?.arbitrageOpportunities ?? 0,
            btcPrice: snap.metadata?.btcPrice,
            storageSize: snap.metadata?.storageSize ?? 0
        }));
        return NextResponse.json({ snapshots: result });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to fetch snapshots' }, { status: 500 });
    }
} 