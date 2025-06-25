import { NextRequest, NextResponse } from 'next/server';
import { getEnergyTokenMetadata } from '@/lib/server/energy';

export async function GET(request: NextRequest) {
    try {
        const energyTokenMetadata = await getEnergyTokenMetadata();
        
        return NextResponse.json(energyTokenMetadata);
    } catch (error) {
        console.error("Error in energy token metadata API:", error);
        return NextResponse.json(
            { 
                error: "Failed to fetch energy token metadata",
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}