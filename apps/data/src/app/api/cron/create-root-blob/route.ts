import { NextRequest, NextResponse } from 'next/server';
import { put, list } from '@vercel/blob';

export const runtime = 'edge';

/**
 * Safely create root blob when it's missing
 * GET /api/cron/create-root-blob?confirm=CREATE_ROOT_BLOB
 * SAFE: Only creates when no root blob exists
 */
export async function GET(request: NextRequest) {
  try {
    // SAFETY CHECK: Require explicit confirmation
    const url = new URL(request.url);
    const confirm = url.searchParams.get('confirm');
    
    if (confirm !== 'CREATE_ROOT_BLOB') {
      return NextResponse.json({
        error: 'SAFETY PROTECTION ACTIVE',
        message: 'This endpoint creates a new root blob structure',
        required: 'Add ?confirm=CREATE_ROOT_BLOB to proceed',
        warning: 'Only use when root blob is confirmed missing'
      }, { status: 400 });
    }

    console.log('[CreateRootBlob] CONFIRMED ACTION - Checking for existing root blob...');

    // Check if root blob already exists
    const ROOT_BLOB_PATH = 'v1/root.json';
    
    try {
      const { blobs } = await list({ limit: 100 });
      const rootExists = blobs.some(blob => blob.pathname === ROOT_BLOB_PATH);
      
      if (rootExists) {
        return NextResponse.json({
          error: 'ROOT BLOB ALREADY EXISTS',
          message: 'Root blob found in storage - no action needed',
          existing: blobs.find(blob => blob.pathname === ROOT_BLOB_PATH),
          recommendation: 'Check blob access permissions instead'
        }, { status: 400 });
      }
      
      console.log('[CreateRootBlob] No existing root blob found - safe to create new one');
      
    } catch (listError) {
      console.error('[CreateRootBlob] Failed to list blobs:', listError);
      return NextResponse.json({
        error: 'CANNOT VERIFY BLOB STATE',
        message: 'Unable to check for existing root blob',
        listError: listError instanceof Error ? listError.message : 'Unknown error'
      }, { status: 500 });
    }

    // Create fresh root blob structure
    const rootBlob = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      addresses: {},
      contracts: {},
      prices: {},
      'price-series': {},
      balances: {},
      'balance-series': {},
      discovered: {},
      metadata: {
        totalSize: 0,
        entryCount: 0,
        regions: ['us-east-1'],
        createdBy: 'create-root-blob-cron',
        createdAt: new Date().toISOString()
      }
    };

    // Save the root blob
    const content = JSON.stringify(rootBlob, null, 0);
    
    const result = await put(ROOT_BLOB_PATH, content, {
      access: 'public',
      contentType: 'application/json',
      cacheControlMaxAge: 300,
      addRandomSuffix: false,
      allowOverwrite: true // Allow overwrite in case of stale/corrupted blob
    });

    console.log('[CreateRootBlob] Successfully created root blob');

    return NextResponse.json({
      success: true,
      message: 'Root blob created successfully',
      timestamp: new Date().toISOString(),
      rootBlob: {
        url: result.url,
        path: ROOT_BLOB_PATH,
        size: content.length,
        structure: {
          version: rootBlob.version,
          sections: Object.keys(rootBlob).filter(k => k !== 'version' && k !== 'lastUpdated' && k !== 'metadata'),
          entryCount: rootBlob.metadata.entryCount
        }
      },
      nextSteps: [
        'Root blob is now available',
        'You can now run data collection crons',
        'Use /api/cron/collect-prices to populate price data',
        'Use /api/cron/collect-balances to populate balance data'
      ]
    });

  } catch (error) {
    console.error('[CreateRootBlob] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to create root blob',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Also support POST for cron services
export const POST = GET;