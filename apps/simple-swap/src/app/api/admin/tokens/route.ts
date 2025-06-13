export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAllTrackedTokens } from '@/lib/price/store';

export async function GET(request: NextRequest) {
    try {
        const tokens = await getAllTrackedTokens();
        return NextResponse.json(tokens);
    } catch (error) {
        console.error('Error fetching tokens:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tokens' },
            { status: 500 }
        );
    }
} 