import { NextResponse } from 'next/server';
import { priceCalculator } from '@/lib/pricing/price-calculator';

export async function GET() {
    return handleWarmPrices();
}

export async function POST() {
    return handleWarmPrices();
}

async function handleWarmPrices() {
    try {
        console.log('[Cron] Starting scheduled price cache warming...');
        const startTime = Date.now();
        
        await priceCalculator.warmCache();
        
        const duration = Date.now() - startTime;
        
        console.log(`[Cron] Price cache warming completed in ${duration}ms`);
        
        return NextResponse.json({
            success: true,
            message: 'Price cache warming completed',
            data: {
                durationMs: duration
            }
        });
        
    } catch (error) {
        console.error('[Cron] Price cache warming failed:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Price cache warming failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}