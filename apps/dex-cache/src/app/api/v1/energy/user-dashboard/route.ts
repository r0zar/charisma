import { NextRequest, NextResponse } from 'next/server';
import { EnergyTokenDashboardData, getEnergyDashboardDataForUser, getUserMaxEnergyCapacity } from '@/lib/server/energy';

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
        const maxCapacity = await getUserMaxEnergyCapacity(address);
        return NextResponse.json({
            maxCapacity,
            userEnergyDashboardData
        } as { maxCapacity: number, userEnergyDashboardData: EnergyTokenDashboardData[] }, {
            headers: {
                'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
            }
        });
    } catch (error) {
        console.error("Error in energy dashboard API:", error);
        return NextResponse.json(
            { error: "Failed to fetch energy data" },
            { status: 500 }
        );
    }
} 