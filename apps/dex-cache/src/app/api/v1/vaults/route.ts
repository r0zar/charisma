import { NextResponse } from 'next/server';
import { getAllVaultData, getVaultData } from '@/lib/pool-service';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // Cache for 5 minutes on CDN, stale-while-revalidate for 1 day
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400'
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contractId = searchParams.get('contractId');
        const protocol = searchParams.get('protocol');
        const type = searchParams.get('type');

        if (contractId) {
            console.log(`Fetching single vault by contractId: ${contractId}`);
            const vault = await getVaultData(contractId);
            if (vault) {
                return NextResponse.json({
                    status: 'success',
                    data: vault,
                }, {
                    status: 200,
                    headers
                });
            } else {
                return NextResponse.json({
                    status: 'error',
                    message: `Vault with contractId ${contractId} not found.`,
                }, {
                    status: 404,
                    headers
                });
            }
        }

        console.log('Fetching vaults');
        let allVaults = await getAllVaultData({ protocol: protocol || undefined, type: type || undefined });

        if (type) {
            allVaults = allVaults.filter(vault => vault.type === type);
            console.log(`Filtered ${allVaults.length} vaults by type: ${type} (protocol: ${protocol})`);
        } else {
            console.log(`Returning ${allVaults.length} vaults (protocol: ${protocol}, no type filter)`);
        }

        return NextResponse.json({
            status: 'success',
            data: allVaults,
            count: allVaults.length,
        }, {
            status: 200,
            headers
        });
    } catch (error: any) {
        console.error('Error in GET /api/v1/vaults:', error);
        return NextResponse.json({
            status: 'error',
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? error?.message : undefined
        }, {
            status: 500,
            headers
        });
    }
} 