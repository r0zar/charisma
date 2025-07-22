import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const runtime = 'edge';

/**
 * Debug endpoint to inspect blob storage contents
 */
export async function GET() {
  try {
    const { blobs } = await list({ limit: 20 });
    
    const blobInfo = blobs.map(blob => ({
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
      url: blob.url.substring(0, 50) + '...' // Truncate URL for safety
    }));
    
    return NextResponse.json({
      success: true,
      totalBlobs: blobs.length,
      blobs: blobInfo
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}