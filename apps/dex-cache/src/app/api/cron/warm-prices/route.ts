import { NextResponse } from 'next/server';
import { priceCalculator } from '@/lib/pricing/price-calculator';

/**
 * Calculate total pool value from vault reserves using underlying token prices
 * @param vault - The vault/pool data
 * @param prices - Current token prices
 * @returns Total pool value in USD, or null if calculation not possible
 */
function calculatePoolValueFromReserves(vault: any, prices: Record<string, number>): number | null {
    if (!vault.tokenA || !vault.tokenB || vault.reservesA === undefined || vault.reservesB === undefined) {
        return null;
    }

    const priceA = prices[vault.tokenA.contractId];
    const priceB = prices[vault.tokenB.contractId];

    if (!priceA || !priceB || vault.reservesA === 0 || vault.reservesB === 0) {
        return null;
    }

    // Calculate token amounts in proper decimal representation
    const tokenADecimals = vault.tokenA.decimals || 6;
    const tokenBDecimals = vault.tokenB.decimals || 6;
    
    const tokenAAmount = vault.reservesA / Math.pow(10, tokenADecimals);
    const tokenBAmount = vault.reservesB / Math.pow(10, tokenBDecimals);

    // Calculate total pool value in USD
    const poolValueA = tokenAAmount * priceA;
    const poolValueB = tokenBAmount * priceB;
    const totalPoolValue = poolValueA + poolValueB;

    return totalPoolValue;
}

export async function GET() {
    return handleWarmPrices();
}

export async function POST() {
    return handleWarmPrices();
}

async function handleWarmPrices() {
    try {
        console.log('[Cron] Starting simplified price cache warming (HTTP-optimized)...');
        const startTime = Date.now();
        
        // Only warm individual token price cache (no API response caching since we use HTTP headers)
        console.log('[Cron] Warming individual token price cache...');
        await priceCalculator.warmCache();
        const duration = Date.now() - startTime;
        console.log(`[Cron] Individual token cache warmed in ${duration}ms`);
        
        return NextResponse.json({
            success: true,
            message: 'Simplified price cache warming completed (HTTP caching enabled)',
            data: {
                totalDurationMs: duration,
                individualCacheDurationMs: duration,
                note: 'API response caching removed - now using HTTP headers for better efficiency'
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

