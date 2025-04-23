import { NextRequest, NextResponse } from 'next/server';
import { getStxAddressContracts } from '@/lib/stacks-api';

export async function GET(request: NextRequest) {
    try {
        // Extract address from query parameters
        const address = request.nextUrl.searchParams.get('address');

        if (!address) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        // Fetch contracts deployed by this address
        const contracts = await getStxAddressContracts(address);

        return NextResponse.json({ contracts });
    } catch (error) {
        console.error('Error fetching contracts:', error);
        return NextResponse.json(
            { error: 'Failed to fetch contracts' },
            { status: 500 }
        );
    }
} 