import { getPricesInRange } from "@/lib/price/store";
import { NextResponse } from "next/server";

interface SeriesPoint {
    time: number;
    value: number;
}

interface AggregatedPoint {
    start: number;
    high: number;
    low: number;
    average: number;
}

function aggregateSeries(series: SeriesPoint[], period: number): AggregatedPoint[] {
    if (!period || period <= 0) return [];

    const buckets: Record<number, { start: number, values: number[] }> = {};

    for (const point of series) {
        const bucketStart = Math.floor(point.time / period) * period;
        if (!buckets[bucketStart]) {
            buckets[bucketStart] = { start: bucketStart, values: [] };
        }
        buckets[bucketStart].values.push(point.value);
    }

    return Object.values(buckets).map(bucket => {
        if (bucket.values.length === 0) {
            return { start: bucket.start, high: 0, low: 0, average: 0 };
        }

        const high = Math.max(...bucket.values);
        const low = Math.min(...bucket.values);
        const average = bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length;

        return { start: bucket.start, high, low, average };
    });
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contractIdsParam = searchParams.get('contractIds');
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        const periodParam = searchParams.get('period');

        // Validate contractIds
        if (!contractIdsParam) {
            return NextResponse.json({ error: 'Missing "contractIds" query param' }, { status: 400 });
        }

        const contractIds = contractIdsParam.split(',').map(s => s.trim()).filter(Boolean);
        if (contractIds.length === 0) {
            return NextResponse.json({ error: 'Empty "contractIds" list' }, { status: 400 });
        }

        // Validate from and to parameters
        if (!fromParam || !toParam) {
            return NextResponse.json({ error: 'Missing "from" or "to" query parameters' }, { status: 400 });
        }

        const fromNum = Number(fromParam) * 1000;
        const toNum = Number(toParam) * 1000;

        if (isNaN(fromNum) || isNaN(toNum)) {
            return NextResponse.json({ error: 'Invalid "from" or "to" parameters - must be numbers' }, { status: 400 });
        }

        if (fromNum >= toNum) {
            return NextResponse.json({ error: '"from" must be less than "to"' }, { status: 400 });
        }

        // Validate period parameter (optional)
        let periodSec: number | undefined;
        if (periodParam) {
            periodSec = Number(periodParam);
            if (isNaN(periodSec) || periodSec <= 0) {
                return NextResponse.json({ error: 'Invalid "period" parameter - must be a positive number' }, { status: 400 });
            }
        }

        const result: Record<string, SeriesPoint[] | AggregatedPoint[]> = {};

        const startTime = Date.now();
        console.log('[BULK-API] Processing request', { 
            tokenCount: contractIds.length, 
            timeRange: `${Math.round((toNum - fromNum) / (24 * 60 * 60 * 1000))}d`,
            aggregated: !!periodSec 
        });

        const results = { processed: 0, totalPoints: 0, errors: 0 };

        // Process all contract IDs
        await Promise.all(contractIds.map(async (contractId: string) => {
            try {
                const raw = await getPricesInRange(contractId, fromNum, toNum);
                results.processed++;

                // Validate the data structure
                if (!Array.isArray(raw)) {
                    console.warn(`[WARN] Invalid data format for ${contractId}: expected array`);
                    result[contractId] = [];
                    return;
                }

                const series: SeriesPoint[] = raw
                    .filter(item => Array.isArray(item) && item.length >= 2)
                    .map(([ts, price]) => ({
                        time: Math.floor(Number(ts) / 1000), // Convert to seconds
                        value: Number(price),
                    }))
                    .filter(point => !isNaN(point.time) && !isNaN(point.value));

                if (periodSec) {
                    result[contractId] = aggregateSeries(series, periodSec);
                } else {
                    result[contractId] = series;
                }
                
                results.totalPoints += series.length;
            } catch (error) {
                console.warn(`[BULK-API] Failed to process token ${contractId.substring(0, 10)}...:`, error.message);
                result[contractId] = [];
                results.errors++;
            }
        }));

        const duration = Date.now() - startTime;
        console.log('[BULK-API] Completed', {
            ...results,
            duration: `${duration}ms`,
            avgPointsPerToken: Math.round(results.totalPoints / results.processed)
        });
        
        return NextResponse.json(result);

    } catch (err) {
        console.error('[ERROR] /api/price-series/bulk', err);

        // Don't expose internal error details in production
        const isDevelopment = process.env.NODE_ENV === 'development';
        const errorResponse = {
            error: 'Server error occurred while processing request',
            ...(isDevelopment && { details: err instanceof Error ? err.message : String(err) })
        };

        return NextResponse.json(errorResponse, { status: 500 });
    }
}