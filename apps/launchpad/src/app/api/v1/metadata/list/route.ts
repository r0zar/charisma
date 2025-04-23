import { NextRequest, NextResponse } from 'next/server';
import { MetadataService } from '@/lib/metadata-service';

export async function GET(req: NextRequest) {
    try {
        // Get the address query parameter
        const url = new URL(req.url);
        const principal = url.searchParams.get('principal');

        // List tokens, filtered by principal if provided
        const tokens = await MetadataService.list(principal || undefined);

        return NextResponse.json({
            success: true,
            metadata: tokens
        });
    } catch (error) {
        console.error('Error listing tokens:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to list tokens'
        }, { status: 500 });
    }
} 