import { NextResponse } from 'next/server';
import { kv } from "@vercel/kv";

export async function POST() {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({
            error: 'Not allowed in production'
        }, { status: 403 });
    }

    try {
        // Clear BTC price cache
        await kv.del('btc-price');
        await kv.del('btc-price-backup');
        
        return NextResponse.json({
            message: 'BTC cache cleared successfully'
        });
    } catch (error) {
        console.error('Failed to clear BTC cache:', error);
        return NextResponse.json({
            error: 'Failed to clear cache'
        }, { status: 500 });
    }
}