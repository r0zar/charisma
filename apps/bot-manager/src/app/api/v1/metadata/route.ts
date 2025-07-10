import { NextRequest, NextResponse } from 'next/server';
import { appState } from '@/data/app-state';
import { defaultState } from '@/data/default-state';
import { metadataStore, isKVAvailable } from '@/lib/kv-store';
import { isFeatureEnabled } from '@/lib/env';

/**
 * GET /api/v1/metadata
 * Returns app metadata from KV store or static fallback
 * Query params:
 * - default: 'true' to use default state
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const useDefault = searchParams.get('default') === 'true';
    
    // Check if we should use KV store
    const useKV = isFeatureEnabled('enableApiMetadata') && await isKVAvailable();
    
    let responseData;
    
    if (useKV) {
      // Use KV store
      const metadata = await metadataStore.getMetadata();
      
      if (metadata) {
        responseData = {
          ...metadata,
          // Add API-specific metadata
          apiVersion: 'v1',
          source: 'kv',
          timestamp: new Date().toISOString(),
        };
      } else {
        return NextResponse.json(
          { 
            error: 'Metadata not found',
            message: 'No metadata found in KV store',
            timestamp: new Date().toISOString(),
          },
          { status: 404 }
        );
      }
    } else {
      // Return empty data when KV is not enabled - no fallback to static data
      responseData = {
        error: 'Metadata API not enabled',
        message: 'Metadata API is not enabled or KV store is not available',
        source: 'disabled',
        timestamp: new Date().toISOString(),
      };
      
      return NextResponse.json(responseData, { status: 503 });
    }

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': useKV ? 'private, s-maxage=60, stale-while-revalidate=300' : 'public, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch metadata',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/metadata
 * Update app metadata (future implementation)
 */
export async function POST(request: NextRequest) {
  try {
    // For now, return not implemented
    // In the future, this could update metadata in Vercel KV
    return NextResponse.json(
      { 
        error: 'Not implemented',
        message: 'Metadata updates not yet supported',
        timestamp: new Date().toISOString(),
      },
      { status: 501 }
    );
  } catch (error) {
    console.error('Error updating metadata:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update metadata',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}