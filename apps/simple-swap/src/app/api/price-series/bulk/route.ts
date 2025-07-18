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
            const errorRes = NextResponse.json({ error: 'Missing "contractIds" query param' }, { status: 400 });
            errorRes.headers.set('Access-Control-Allow-Origin', '*');
            return errorRes;
        }

        const contractIds = contractIdsParam.split(',').map(s => s.trim()).filter(Boolean);
        if (contractIds.length === 0) {
            const errorRes = NextResponse.json({ error: 'Empty "contractIds" list' }, { status: 400 });
            errorRes.headers.set('Access-Control-Allow-Origin', '*');
            return errorRes;
        }

        // Validate from and to parameters
        if (!fromParam || !toParam) {
            const errorRes = NextResponse.json({ error: 'Missing "from" or "to" query parameters' }, { status: 400 });
            errorRes.headers.set('Access-Control-Allow-Origin', '*');
            return errorRes;
        }

        const fromNum = Number(fromParam) * 1000;
        const toNum = Number(toParam) * 1000;

        if (isNaN(fromNum) || isNaN(toNum)) {
            const errorRes = NextResponse.json({ error: 'Invalid "from" or "to" parameters - must be numbers' }, { status: 400 });
            errorRes.headers.set('Access-Control-Allow-Origin', '*');
            return errorRes;
        }

        if (fromNum >= toNum) {
            const errorRes = NextResponse.json({ error: '"from" must be less than "to"' }, { status: 400 });
            errorRes.headers.set('Access-Control-Allow-Origin', '*');
            return errorRes;
        }

        // Validate period parameter (optional)
        let periodSec: number | undefined;
        if (periodParam) {
            periodSec = Number(periodParam);
            if (isNaN(periodSec) || periodSec <= 0) {
                const errorRes = NextResponse.json({ error: 'Invalid "period" parameter - must be a positive number' }, { status: 400 });
                errorRes.headers.set('Access-Control-Allow-Origin', '*');
                return errorRes;
            }
        }

        const result: Record<string, SeriesPoint[] | AggregatedPoint[]> = {};

        const startTime = Date.now();
        console.log('[BULK-API] Processing request via centralized service', {
            tokenCount: contractIds.length,
            timeRange: `${Math.round((toNum - fromNum) / (24 * 60 * 60 * 1000))}d`,
            aggregated: !!periodSec
        });

        const results = { processed: 0, totalPoints: 0, errors: 0 };

        try {
            // Use centralized PriceSeriesAPI for fetching
            const { PriceSeriesAPI, PriceSeriesStorage } = await import('@services/prices');
            const storage = new PriceSeriesStorage();
            const priceSeriesAPI = new PriceSeriesAPI(storage);

            const fromSec = Math.floor(fromNum / 1000); // Convert to seconds
            const toSec = Math.floor(toNum / 1000); // Convert to seconds

            // Determine appropriate timeframe based on time range
            const timeRangeHours = (toSec - fromSec) / 3600;
            let timeframe: '1m' | '5m' | '1h' | '1d';
            if (timeRangeHours <= 24) {
                timeframe = '5m';
            } else if (timeRangeHours <= 168) { // 1 week
                timeframe = '1h';
            } else {
                timeframe = '1d';
            }

            // Fetch data for each token individually
            const bulkData: Record<string, any[]> = {};

            for (const contractId of contractIds) {
                try {
                    const historyResponse = await priceSeriesAPI.getPriceHistory({
                        tokenId: contractId,
                        timeframe,
                        limit: 1000,
                        endTime: toSec
                    });

                    if (historyResponse.success && historyResponse.data) {
                        // Filter by time range and convert to expected format
                        bulkData[contractId] = historyResponse.data
                            .filter(entry => entry.timestamp >= fromSec && entry.timestamp <= toSec)
                            .map(entry => ({
                                timestamp: entry.timestamp,
                                price: entry.usdPrice
                            }));
                    } else {
                        console.warn(`[BULK-API] Failed to get history for ${contractId}: ${historyResponse.error}`);
                        bulkData[contractId] = [];
                    }
                } catch (error) {
                    console.error(`[BULK-API] Error fetching ${contractId}:`, error);
                    bulkData[contractId] = [];
                }
            }

            console.log('[BULK-API] Received bulk data from centralized service:', {
                requestedTokens: contractIds.length,
                receivedTokens: Object.keys(bulkData).length,
                successfulFetches: Object.values(bulkData).filter(series => Array.isArray(series) && series.length > 0).length
            });

            // Process the centralized service response
            Object.entries(bulkData).forEach(([contractId, seriesData]) => {
                try {
                    results.processed++;

                    if (!Array.isArray(seriesData)) {
                        console.warn(`[BULK-API] Invalid data format for ${contractId}: expected array, got ${typeof seriesData}`);
                        result[contractId] = [];
                        return;
                    }

                    // Convert centralized service format to SeriesPoint format
                    const series: SeriesPoint[] = seriesData
                        .map((point: any) => {
                            // Handle both price series storage format and direct format
                            const time = point.timestamp || point.time;
                            const value = point.price || point.value;

                            return {
                                time: Number(time),
                                value: Number(value),
                            };
                        })
                        .filter(point => !isNaN(point.time) && !isNaN(point.value));

                    if (periodSec) {
                        result[contractId] = aggregateSeries(series, periodSec);
                    } else {
                        result[contractId] = series;
                    }

                    results.totalPoints += series.length;
                } catch (error) {
                    console.warn(`[BULK-API] Failed to process token ${contractId.substring(0, 10)}...:`, error instanceof Error ? error.message : 'Unknown error');
                    result[contractId] = [];
                    results.errors++;
                }
            });

            // Handle any tokens that weren't returned by the centralized service
            contractIds.forEach(contractId => {
                if (!(contractId in result)) {
                    console.warn(`[BULK-API] Token ${contractId.substring(0, 10)}... not returned by centralized service`);
                    result[contractId] = [];
                    results.errors++;
                }
            });

        } catch (error) {
            console.error('[BULK-API] Centralized service request failed:', error);
            // Fallback: return empty arrays for all tokens
            contractIds.forEach(contractId => {
                result[contractId] = [];
                results.errors++;
            });
        }

        const duration = Date.now() - startTime;
        console.log('[BULK-API] Completed', {
            ...results,
            duration: `${duration}ms`,
            avgPointsPerToken: Math.round(results.totalPoints / results.processed)
        });

        const response = NextResponse.json(result);

        // Add CORS headers
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        return response;

    } catch (err) {
        console.error('[ERROR] /api/price-series/bulk', err);

        // Don't expose internal error details in production
        const isDevelopment = process.env.NODE_ENV === 'development';
        const errorBody = {
            error: 'Server error occurred while processing request',
            ...(isDevelopment && { details: err instanceof Error ? err.message : String(err) })
        };

        const errorResponse = NextResponse.json(errorBody, { status: 500 });

        // Add CORS headers to error response
        errorResponse.headers.set('Access-Control-Allow-Origin', '*');
        errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        return errorResponse;
    }
}

// Handle preflight OPTIONS requests
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}