import { NextResponse } from 'next/server';
import { getBulkPriceStats } from '@/lib/price/metrics';

export const maxDuration = 300; // 5 minutes timeout
export const revalidate = 60; // Cache for 1 minute

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contractIdsParam = searchParams.get('contractIds');

        if (!contractIdsParam) {
            return NextResponse.json({ error: 'Missing "contractIds" query param' }, { status: 400 });
        }

        const contractIds = contractIdsParam.split(',').map(s => s.trim()).filter(Boolean);
        if (contractIds.length === 0) {
            return NextResponse.json({ error: 'Empty "contractIds" list' }, { status: 400 });
        }

        if (contractIds.length > 1000) {
            return NextResponse.json({ error: 'Too many contract IDs (max 1000)' }, { status: 400 });
        }

        const startTime = Date.now();
        console.log('[BULK-PRICE-STATS] Processing request for', contractIds.length, 'tokens');

        const bulkStats = await getBulkPriceStats(contractIds);

        const duration = Date.now() - startTime;
        console.log('[BULK-PRICE-STATS] Completed in', duration, 'ms');

        return NextResponse.json(bulkStats);

    } catch (error) {
        console.error('[ERROR] /api/price-stats/bulk', error);

        const isDevelopment = process.env.NODE_ENV === 'development';
        const errorResponse = {
            error: 'Server error occurred while processing bulk price stats',
            ...(isDevelopment && { details: error instanceof Error ? error.message : String(error) })
        };

        return NextResponse.json(errorResponse, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { contractIds } = body;

        if (!Array.isArray(contractIds)) {
            return NextResponse.json({ error: 'contractIds must be an array' }, { status: 400 });
        }

        if (contractIds.length === 0) {
            return NextResponse.json({ error: 'Empty contractIds array' }, { status: 400 });
        }

        if (contractIds.length > 1000) {
            return NextResponse.json({ error: 'Too many contract IDs (max 1000)' }, { status: 400 });
        }

        const startTime = Date.now();
        console.log('[BULK-PRICE-STATS] POST request for', contractIds.length, 'tokens');

        const bulkStats = await getBulkPriceStats(contractIds);

        const duration = Date.now() - startTime;
        console.log('[BULK-PRICE-STATS] POST completed in', duration, 'ms');

        return NextResponse.json(bulkStats);

    } catch (error) {
        console.error('[ERROR] /api/price-stats/bulk POST', error);

        const isDevelopment = process.env.NODE_ENV === 'development';
        const errorResponse = {
            error: 'Server error occurred while processing bulk price stats',
            ...(isDevelopment && { details: error instanceof Error ? error.message : String(error) })
        };

        return NextResponse.json(errorResponse, { status: 500 });
    }
}