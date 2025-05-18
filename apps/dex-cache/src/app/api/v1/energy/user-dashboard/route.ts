import { NextRequest, NextResponse } from 'next/server';
import { getEnergyDashboardDataForUser } from '@/lib/server/energy';

export async function GET(request: NextRequest) {
    const address = request.nextUrl.searchParams.get('address');

    if (!address) {
        return NextResponse.json(
            { error: "Missing address parameter" },
            { status: 400 }
        );
    }

    try {
        const userEnergyDashboardData = await getEnergyDashboardDataForUser(address);
        return NextResponse.json(userEnergyDashboardData);
    } catch (error) {
        console.error("Error in energy dashboard API:", error);
        return NextResponse.json(
            { error: "Failed to fetch energy data" },
            { status: 500 }
        );
    }
} 