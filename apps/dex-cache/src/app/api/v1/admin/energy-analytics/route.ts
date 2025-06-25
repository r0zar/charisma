import { NextRequest, NextResponse } from 'next/server';
import { getAllEnergyAnalyticsData } from '@/lib/server/energy';

export async function GET(request: NextRequest) {
    try {
        const allAnalyticsData = await getAllEnergyAnalyticsData();
        
        return NextResponse.json({
            contracts: allAnalyticsData,
            timestamp: Date.now(),
            success: true
        });
    } catch (error) {
        console.error("Error in energy analytics admin API:", error);
        return NextResponse.json(
            { 
                error: "Failed to fetch energy analytics data",
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}