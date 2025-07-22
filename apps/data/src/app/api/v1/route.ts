import { NextResponse } from 'next/server';
import { blobStorageService } from '@/services/blob-storage-service';
import { generateCacheHeaders, getCachePolicy } from '@/lib/cache-strategy';

export const runtime = 'edge';

/**
 * GET /api/v1 - Return root blob data
 */
export async function GET() {
  try {
    const rootBlob = await blobStorageService.getRootBlob();
    
    const cacheHeaders = generateCacheHeaders(getCachePolicy('root'), {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID
    });

    cacheHeaders.set('X-Data-Type', 'root-blob');
    
    return NextResponse.json(rootBlob, { headers: cacheHeaders });
    
  } catch (error) {
    console.error('Root API error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get root data',
        timestamp: new Date().toISOString() 
      },
      { status: 500 }
    );
  }
}