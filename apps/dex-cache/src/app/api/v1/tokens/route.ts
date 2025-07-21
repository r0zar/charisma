import { NextResponse } from 'next/server';
import { listVaultTokens } from '@/lib/pool-service';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // Optimized caching: 15min browser, 1hr CDN, 6hr Vercel CDN (tokens change infrequently)
    'Cache-Control': 'public, max-age=900',
    'CDN-Cache-Control': 'public, s-maxage=3600',
    'Vercel-CDN-Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400'
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: Request) {
    try {
        console.log('Fetching all tokens');

        const data = await listVaultTokens();
        console.log(`Returning ${data.length} tokens`);

        return NextResponse.json({
            status: 'success',
            data,
            count: data.length,
        }, {
            status: 200,
            headers
        });
    } catch (error: any) {
        console.error('Error fetching all tokens', error);
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