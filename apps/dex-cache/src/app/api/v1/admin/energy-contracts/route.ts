import { NextRequest, NextResponse } from 'next/server';
import { getAllEnergyAnalyticsData, fetchHoldToEarnVaults } from '@/lib/server/energy';
import { fetchMetadata } from '@repo/tokens';

export async function GET(request: NextRequest) {
    try {
        const [analyticsData, vaults, allTokenMetadata] = await Promise.all([
            getAllEnergyAnalyticsData(),
            fetchHoldToEarnVaults(),
            fetchMetadata()
        ]);
        
        return NextResponse.json({
            contracts: analyticsData,
            vaults: vaults,
            metadata: allTokenMetadata,
            timestamp: Date.now(),
            success: true
        });
    } catch (error) {
        console.error("Error in energy contracts admin API:", error);
        return NextResponse.json(
            { 
                error: "Failed to fetch energy contracts data",
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}