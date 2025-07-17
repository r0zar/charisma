import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

export async function POST(request: NextRequest) {
    try {
        if (!BLOB_READ_WRITE_TOKEN) {
            return NextResponse.json({
                success: false,
                error: 'BLOB_READ_WRITE_TOKEN not configured'
            }, { status: 500 });
        }

        // Create a test file to upload
        const testData = {
            message: 'Test blob upload',
            timestamp: Date.now(),
            purpose: 'Get blob storage URL for dashboard'
        };

        // Upload to blob storage
        const result = await put('test/dashboard-test.json', JSON.stringify(testData, null, 2), {
            access: 'public',
            token: BLOB_READ_WRITE_TOKEN,
            cacheControlMaxAge: 300
        });

        // Extract base URL from the full URL
        const fullUrl = result.url;
        const baseUrl = fullUrl.substring(0, fullUrl.indexOf('/test/dashboard-test.json'));

        return NextResponse.json({
            success: true,
            fullUrl,
            baseUrl,
            filename: 'test/dashboard-test.json'
        });

    } catch (error) {
        console.error('[TestBlob] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}