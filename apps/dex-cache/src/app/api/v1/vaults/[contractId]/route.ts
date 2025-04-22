import { NextResponse } from 'next/server';
import { getVaultData, addVaultIdToManagedList } from '@/lib/vaultService';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' // 5 min edge, 1d SWR
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

export async function GET(
    _request: Request,
    context: { params: { contractId: string } }
) {
    const { contractId } = context.params;
    const refresh = _request.url.includes('refresh=true');

    if (!contractId) {
        return NextResponse.json({ status: 'error', error: 'Contract ID is required' }, { status: 400, headers });
    }

    // Special exception for .stx or other special tokens that don't follow the standard pattern
    const isSpecialToken = contractId === '.stx';
    if (!isSpecialToken && !contractId.includes('.')) {
        return NextResponse.json({ status: 'error', error: 'Invalid contract ID format. Expect address.contract-name' }, { status: 400, headers });
    }

    try {
        const vault = await getVaultData(contractId, refresh);
        if (!vault) {
            return NextResponse.json({ status: 'error', error: 'Vault not found' }, { status: 404, headers });
        }

        // add to managed list for future fetches
        await addVaultIdToManagedList(contractId);

        return NextResponse.json({ status: 'success', data: vault }, { status: 200, headers });
    } catch (error: any) {
        console.error('Error fetching vault', contractId, error);
        return NextResponse.json({ status: 'error', error: 'Internal Server Error', message: process.env.NODE_ENV === 'development' ? error?.message : undefined }, { status: 500, headers });
    }
} 