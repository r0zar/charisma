/**
 * NEW Unified Price Stats API Endpoint
 * 
 * This demonstrates how simple-swap integrates with the unified price service.
 * This endpoint can eventually replace the existing /api/price-stats/bulk endpoint.
 */

import { NextResponse } from 'next/server';
import { getPriceService } from '@/lib/price-service-setup';

export const maxDuration = 300; // 5 minutes timeout
export const revalidate = 60; // Cache for 1 minute

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contractIdsParam = searchParams.get('contractIds');

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

        if (contractIds.length > 1000) {
            const errorRes = NextResponse.json({ error: 'Too many contract IDs (max 1000)' }, { status: 400 });
            errorRes.headers.set('Access-Control-Allow-Origin', '*');
            return errorRes;
        }

        console.log(`[Unified Price API] Calculating prices for ${contractIds.length} tokens`);

        // Use the unified price service
        const priceService = await getPriceService();
        const bulkResult = await priceService.calculateBulkPrices(contractIds);

        if (!bulkResult.success) {
            console.error('[Unified Price API] Bulk price calculation failed:', bulkResult.errors);
            const errorRes = NextResponse.json({ 
                error: 'Failed to calculate prices',
                details: bulkResult.errors ? Object.fromEntries(bulkResult.errors) : undefined
            }, { status: 500 });
            errorRes.headers.set('Access-Control-Allow-Origin', '*');
            return errorRes;
        }

        // Convert to the format expected by simple-swap components
        const priceStats = Array.from(bulkResult.prices.entries()).map(([contractId, priceData]) => ({
            contractId,
            price: priceData.usdPrice,
            confidence: priceData.confidence,
            lastUpdated: priceData.lastUpdated,
            
            // Enhanced fields from unified price service
            isLpToken: priceData.isLpToken || false,
            intrinsicValue: priceData.intrinsicValue || null,
            marketPrice: priceData.marketPrice || null,
            priceDeviation: priceData.priceDeviation || null,
            isArbitrageOpportunity: priceData.isArbitrageOpportunity || false,
            
            // Path information for debugging
            pathsUsed: priceData.calculationDetails?.pathsUsed || 0,
            totalLiquidity: priceData.calculationDetails?.totalLiquidity || 0,
            priceVariation: priceData.calculationDetails?.priceVariation || 0,
            priceSource: priceData.calculationDetails?.priceSource || 'market',
            
            // Historical changes (would be calculated from stored price history)
            change1h: null,   // TODO: Calculate from price history
            change24h: null,  // TODO: Calculate from price history  
            change7d: null,   // TODO: Calculate from price history
        }));

        const response = NextResponse.json({
            success: true,
            data: priceStats,
            count: priceStats.length,
            timestamp: Date.now(),
            
            // Additional metadata from unified service
            debugInfo: bulkResult.debugInfo,
            errors: bulkResult.errors ? Object.fromEntries(bulkResult.errors) : {},
        });

        // Add CORS headers
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        console.log(`[Unified Price API] Successfully returned ${priceStats.length} price stats`);
        return response;

    } catch (error) {
        console.error('[ERROR] /api/price-stats/unified', error);

        const isDevelopment = process.env.NODE_ENV === 'development';
        const errorResponse = {
            success: false,
            error: 'Server error occurred while processing unified price stats',
            timestamp: Date.now(),
            ...(isDevelopment && { details: error instanceof Error ? error.message : String(error) })
        };

        const errorRes = NextResponse.json(errorResponse, { status: 500 });
        errorRes.headers.set('Access-Control-Allow-Origin', '*');
        return errorRes;
    }
}

export async function OPTIONS() {
    const response = new Response(null, { status: 204 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
}