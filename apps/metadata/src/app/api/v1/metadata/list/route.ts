import { NextRequest, NextResponse } from 'next/server';
import { MetadataService } from '@/lib/metadata-service';
import { generateCorsHeaders } from '@/lib/cors-helper';

export async function GET(req: NextRequest) {
    const headers = generateCorsHeaders(req, 'GET');

    try {
        // Get the address query parameter
        const url = new URL(req.url);
        const principal = url.searchParams.get('principal');

        // List tokens, filtered by principal if provided
        const tokens = await MetadataService.list(principal || undefined);

        return NextResponse.json({
            success: true,
            metadata: tokens
        }, { headers });
    } catch (error) {
        console.error('Error listing tokens:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to list tokens'
        }, { status: 500, headers });
    }
}

export async function OPTIONS(req: NextRequest) {
    const headers = generateCorsHeaders(req, 'GET, OPTIONS');
    headers.set('Access-Control-Max-Age', '86400'); // 24 hours
    return new NextResponse(null, { status: 204, headers });
} 