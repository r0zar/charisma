import { NextRequest, NextResponse } from 'next/server';
import { getStxAddressContracts } from '@/lib/stacks-api';
import { Contract } from '@/components/contracts/contracts-list';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: 'Contract ID is required' }, { status: 400 });
        }

        // Get stxAddress from query parameters - needed to fetch all contracts for this user
        const stxAddress = request.nextUrl.searchParams.get('address');

        if (!stxAddress) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        // Fetch all contracts for this address
        const contracts = await getStxAddressContracts(stxAddress);

        // Find the specific contract by its ID (tx_id)
        const contract = contracts.find(c => c.id === id);

        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        return NextResponse.json({ contract });
    } catch (error) {
        console.error('Error fetching contract:', error);
        return NextResponse.json(
            { error: 'Failed to fetch contract' },
            { status: 500 }
        );
    }
} 