import { NextRequest, NextResponse } from 'next/server';
import { getAllEnergyAnalyticsData, getEnergyTokenMetadata } from '@/lib/server/energy';
import { fetchMetadata } from '@repo/tokens';
import { 
    calculateEnergyPerBlock, 
    compareTokenEnergyRates,
    type TokenEnergyRate,
    type TokenRateHistory 
} from '@/lib/energy/rate-analytics';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const timeframe = searchParams.get('timeframe') || '30d';
        
        // Parse timeframe to hours
        const timeframeHours = timeframe === '7d' ? 7 * 24 : 
                             timeframe === '90d' ? 90 * 24 : 
                             30 * 24; // default 30d

        const [allAnalyticsData, energyTokenMetadata, allTokenMetadata] = await Promise.all([
            getAllEnergyAnalyticsData(),
            getEnergyTokenMetadata(),
            fetchMetadata()
        ]);

        // Calculate current energy rates per block for each token
        const tokenRates: TokenEnergyRate[] = [];
        
        for (const { contractId, analyticsData } of allAnalyticsData) {
            if (!analyticsData || analyticsData.logs.length === 0) continue;
            
            const rate = calculateEnergyPerBlock(
                analyticsData.logs, 
                contractId, 
                Math.min(timeframeHours, 24) // Use max 24h for current rate calculation
            );
            
            // Enhance with token metadata
            const metadata = allTokenMetadata.find((token: any) => token.contractId === contractId);
            if (metadata) {
                rate.tokenSymbol = metadata.symbol || rate.tokenSymbol;
                rate.tokenName = metadata.name || rate.tokenName;
            }
            
            tokenRates.push(rate);
        }

        // Calculate rate histories with trend analysis
        const rateHistories: TokenRateHistory[] = compareTokenEnergyRates(
            allAnalyticsData,
            allTokenMetadata
        );

        // Sort token rates by energy per block (highest first)
        tokenRates.sort((a, b) => b.energyPerBlock - a.energyPerBlock);

        return NextResponse.json({
            tokenRates,
            rateHistories,
            energyTokenMetadata,
            timeframe,
            timestamp: Date.now(),
            success: true
        });
    } catch (error) {
        console.error("Error in energy rate analytics API:", error);
        return NextResponse.json(
            { 
                error: "Failed to fetch energy rate analytics",
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}