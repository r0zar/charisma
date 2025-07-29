import { NextResponse } from 'next/server';
import { getVaultData } from '@/lib/pool-service';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // Optimized caching: 30min browser, 2hr CDN, 6hr Vercel CDN (individual vault data is stable)
    'Cache-Control': 'public, max-age=1800',
    'CDN-Cache-Control': 'public, s-maxage=7200',
    'Vercel-CDN-Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=172800'
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

export async function GET(
    _request: Request,
    context: { params: Promise<{ contractId: string }> }
) {
    const { contractId } = await context.params;

    if (!contractId) {
        return NextResponse.json({ status: 'error', error: 'Contract ID is required' }, { status: 400, headers });
    }

    // Special exception for .stx or other special tokens that don't follow the standard pattern
    const isSpecialToken = contractId === '.stx';
    if (!isSpecialToken && !contractId.includes('.')) {
        return NextResponse.json({ status: 'error', error: 'Invalid contract ID format. Expect address.contract-name' }, { status: 400, headers });
    }

    try {
        const vault = await getVaultData(contractId);
        if (!vault) {
            return NextResponse.json({ status: 'error', error: 'Vault not found' }, { status: 404, headers });
        }

        return NextResponse.json({ status: 'success', data: vault }, { status: 200, headers });
    } catch (error: any) {
        console.error('Error fetching vault', contractId, error);
        return NextResponse.json({ status: 'error', error: 'Internal Server Error', message: process.env.NODE_ENV === 'development' ? error?.message : undefined }, { status: 500, headers });
    }
} 