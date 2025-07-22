import { NextRequest, NextResponse } from 'next/server';
import { blobStorageService } from '@/lib/storage/blob-storage-service';
import { CACHE_POLICIES, generateCacheHeaders } from '@/lib/utils/cache-strategy';

export const runtime = 'edge';

/**
 * GET /api/tree - Get navigation tree structure
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix') || '';
    const debug = url.searchParams.get('debug') === 'true';
    
    const tree = await blobStorageService.buildNavigationTree();
    
    // Filter tree by prefix if provided
    let filteredTree = tree;
    if (prefix) {
      const prefixParts = prefix.split('/');
      let current = tree;
      
      for (const part of prefixParts) {
        if (current[part] && current[part].type === 'directory') {
          current = current[part].children;
        } else {
          filteredTree = {};
          break;
        }
      }
      
      if (current !== tree) {
        filteredTree = current;
      }
    }
    
    // Generate optimized cache headers for tree data
    const cacheHeaders = generateCacheHeaders(CACHE_POLICIES.TREE, {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID
    });
    
    // Add performance headers
    const processingTime = Date.now() - startTime;
    cacheHeaders.set('X-Response-Time', `${processingTime}ms`);
    
    if (debug) {
      cacheHeaders.set('X-Cache-Policy', 'TREE');
      cacheHeaders.set('X-Generated-At', new Date().toISOString());
      cacheHeaders.set('X-Tree-Nodes', Object.keys(filteredTree).length.toString());
    }
    
    return NextResponse.json(filteredTree, { headers: cacheHeaders });
    
  } catch (error) {
    console.error('Tree API error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: error.message,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}