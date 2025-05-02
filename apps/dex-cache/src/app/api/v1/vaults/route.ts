import { NextResponse } from 'next/server';
import { getAllVaultData } from '@/lib/vaultService';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': process.env.NODE_ENV === 'development'
        ? 'no-store'
        : 'max-age=60, stale-while-revalidate=600' // 1min cache, 10min stale
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: Request) {
    try {
        console.log('Fetching all vaults');
        const data = await getAllVaultData();
        console.log(`Returning ${data.length} vaults`);

        console.log(data)

        return NextResponse.json({
            status: 'success',
            data,
            count: data.length,
        }, {
            status: 200,
            headers
        });
    } catch (error: any) {
        console.error('Error fetching all vaults', error);
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