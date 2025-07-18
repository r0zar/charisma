import { PriceSeriesAPI, PriceSeriesStorage } from '@services/prices';
import { TimeSeriesAdapter } from '@/lib/charts/time-series-adapter';
import { NextResponse } from "next/server";

// Initialize the Price Series API
const storage = new PriceSeriesStorage();
const priceAPI = new PriceSeriesAPI(storage);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const timeframe = searchParams.get('timeframe');

    if (!contractId) {
        return NextResponse.json(
            { error: 'Missing "contractId" query param' },
            { status: 400 },
        );
    }

    const now = Math.floor(Date.now() / 1000); // Convert to seconds for API
    let from: number;
    let apiTimeframe: '5m' | '1h' | '1d' = '5m'; // Default timeframe

    // Determine time range and appropriate API timeframe
    if (timeframe) {
        const { fromTimestamp, suggestedTimeframe } = parseTimeframeToRange(timeframe, now);
        from = fromTimestamp;
        apiTimeframe = suggestedTimeframe;
    } else {
        const fromParam = searchParams.get('from');
        from = fromParam ? Math.floor(Number(fromParam) / 1000) : now - (30 * 24 * 60 * 60); // 30 days default

        // Determine best timeframe based on range
        const rangeHours = (now - from) / 3600;
        if (rangeHours <= 24) {
            apiTimeframe = '5m';
        } else if (rangeHours <= 168) { // 1 week
            apiTimeframe = '1h';
        } else {
            apiTimeframe = '1d';
        }
    }

    const toParam = searchParams.get('to');
    const to = toParam ? Math.floor(Number(toParam) / 1000) : now;

    try {
        // Use the Price Series API to get historical data
        const response = await priceAPI.getPriceHistory({
            tokenId: contractId,
            timeframe: apiTimeframe,
            limit: 1000, // Maximum data points
            endTime: to
        });

        if (!response.success || !response.data) {
            return NextResponse.json(
                { error: response.error || 'Failed to fetch price data' },
                { status: 500 }
            );
        }

        // Convert to chart format and filter by time range
        const series = TimeSeriesAdapter.entriesToLineDataWithRange(
            response.data,
            from,
            to
        );

        // Add cache headers based on whether data was cached
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        if (response.cached) {
            headers['X-Cache'] = 'HIT';
            headers['Cache-Control'] = 'public, max-age=300'; // 5 minutes
        } else {
            headers['X-Cache'] = 'MISS';
            headers['Cache-Control'] = 'public, max-age=60'; // 1 minute for fresh data
        }

        return NextResponse.json(series, { headers });

    } catch (error) {
        console.error('Price API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Parse timeframe string and return timestamp range with suggested API timeframe
 */
function parseTimeframeToRange(timeframe: string, nowSeconds: number): {
    fromTimestamp: number;
    suggestedTimeframe: '5m' | '1h' | '1d';
} {
    const match = timeframe.match(/^(\d+)([hdw])$/);
    if (!match) {
        // Default to 4 days with hourly data
        return {
            fromTimestamp: nowSeconds - (4 * 24 * 60 * 60),
            suggestedTimeframe: '1h'
        };
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 'h':
            const hours = value;
            return {
                fromTimestamp: nowSeconds - (hours * 60 * 60),
                suggestedTimeframe: hours <= 6 ? '5m' : '1h'
            };
        case 'd':
            const days = value;
            return {
                fromTimestamp: nowSeconds - (days * 24 * 60 * 60),
                suggestedTimeframe: days <= 1 ? '5m' : days <= 7 ? '1h' : '1d'
            };
        case 'w':
            const weeks = value;
            return {
                fromTimestamp: nowSeconds - (weeks * 7 * 24 * 60 * 60),
                suggestedTimeframe: weeks <= 1 ? '1h' : '1d'
            };
        default:
            return {
                fromTimestamp: nowSeconds - (4 * 24 * 60 * 60),
                suggestedTimeframe: '1h'
            };
    }
}