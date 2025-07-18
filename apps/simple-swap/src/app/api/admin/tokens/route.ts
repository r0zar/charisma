export const dynamic = 'force-dynamic';

import { priceSeriesService } from '@/lib/charts/price-series-service';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const tokens = await priceSeriesService.getAllTokens();
        return NextResponse.json(tokens);
    } catch (error) {
        console.error('Error fetching tokens:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tokens' },
            { status: 500 }
        );
    }
} 