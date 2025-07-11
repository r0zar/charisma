import { NextRequest, NextResponse } from 'next/server';

import { appState } from '@/data/app-state';
import { AppMetadataSchema } from '@/schemas/app-metadata.schema';

/**
 * GET /api/v1/metadata
 * Returns app metadata from static app state
 */
export async function GET(request: NextRequest) {
  try {
    // Use static metadata from app state
    const metadata = appState.metadata;

    // Validate the metadata with schema
    const validation = AppMetadataSchema.safeParse(metadata);
    if (!validation.success) {
      console.error('Metadata validation failed:', validation.error);
      return NextResponse.json(
        {
          error: 'Invalid metadata structure',
          details: validation.error.issues,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(validation.data, {
      status: 200,
      headers: {
        'Cache-Control': 'private, s-maxage=10, stale-while-revalidate=60',
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