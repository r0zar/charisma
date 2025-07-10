import { NextRequest, NextResponse } from 'next/server';
import { appState } from '@/data/app-state';
import { defaultState } from '@/data/default-state';
import { marketDataStore, isKVAvailable } from '@/lib/kv-store';
import { isFeatureEnabled } from '@/lib/env';

/**
 * GET /api/v1/market
 * Returns market data (data, analytics, pools)
 * Query params:
 * - default: 'true' to use default state
 * - section: 'data' | 'analytics' | 'pools' to get specific section
 * - limit: limit number of pools returned
 * - sortBy: 'apr' | 'tvl' | 'volume' to sort pools
 * - sortOrder: 'asc' | 'desc' for sort order
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const useDefault = searchParams.get('default') === 'true';
    const section = searchParams.get('section') as 'data' | 'analytics' | 'pools' | null;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const sortBy = searchParams.get('sortBy') as 'apr' | 'tvl' | 'volume' | null;
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc';
    
    // Check if we should use KV store for market data
    const useKV = isFeatureEnabled('enableApiMarket') && await isKVAvailable();
    
    // Get source data
    const sourceData = useDefault ? defaultState : appState;
    
    // Get market data from KV store if enabled, otherwise use static data
    let marketData = sourceData.market.data;
    if (useKV) {
      const kvMarketData = await marketDataStore.getMarketData();
      if (kvMarketData) {
        marketData = kvMarketData;
      } else {
        // No market data in KV store - return error
        return NextResponse.json(
          { 
            error: 'Market data not found',
            message: 'No market data found in KV store',
            timestamp: new Date().toISOString(),
          },
          { status: 404 }
        );
      }
    }
    
    let responseData;
    
    if (section) {
      // Return specific section
      let sectionData;
      
      if (section === 'data') {
        // Use KV market data if available, otherwise static data
        sectionData = marketData;
      } else {
        // For analytics and pools, use static data (they haven't been migrated yet)
        if (!sourceData.market[section]) {
          return NextResponse.json(
            { 
              error: 'Invalid section',
              message: `Section '${section}' not found`,
              timestamp: new Date().toISOString(),
            },
            { status: 404 }
          );
        }
        sectionData = sourceData.market[section];
      }
      
      // Apply sorting and pagination for pools
      if (section === 'pools' && Array.isArray(sectionData)) {
        // Sort pools if sortBy is specified
        if (sortBy) {
          sectionData = [...sectionData].sort((a: any, b: any) => {
            let aValue, bValue;
            
            switch (sortBy) {
              case 'apr':
                aValue = a.apr;
                bValue = b.apr;
                break;
              case 'tvl':
                aValue = a.totalValueLocked;
                bValue = b.totalValueLocked;
                break;
              case 'volume':
                aValue = a.volume24h;
                bValue = b.volume24h;
                break;
              default:
                return 0;
            }
            
            if (sortOrder === 'asc') {
              return aValue - bValue;
            } else {
              return bValue - aValue;
            }
          });
        }
        
        // Apply pagination
        if (limit !== undefined) {
          sectionData = sectionData.slice(0, limit);
        }
      }
      
      responseData = {
        [section]: sectionData,
        filters: {
          sortBy,
          sortOrder,
          limit,
        },
        source: section === 'data' && useKV ? 'kv' : 'static',
        timestamp: new Date().toISOString(),
      };
    } else {
      // Return all market data with filters applied
      let pools = sourceData.market.pools;
      
      // Sort pools if sortBy is specified
      if (sortBy) {
        pools = [...pools].sort((a: any, b: any) => {
          let aValue, bValue;
          
          switch (sortBy) {
            case 'apr':
              aValue = a.apr;
              bValue = b.apr;
              break;
            case 'tvl':
              aValue = a.totalValueLocked;
              bValue = b.totalValueLocked;
              break;
            case 'volume':
              aValue = a.volume24h;
              bValue = b.volume24h;
              break;
            default:
              return 0;
          }
          
          if (sortOrder === 'asc') {
            return aValue - bValue;
          } else {
            return bValue - aValue;
          }
        });
      }
      
      // Apply pagination to pools
      if (limit !== undefined) {
        pools = pools.slice(0, limit);
      }
      
      responseData = {
        data: marketData,
        analytics: sourceData.market.analytics,
        pools,
        filters: {
          sortBy,
          sortOrder,
          limit,
        },
        source: useKV ? 'kv' : 'static',
        timestamp: new Date().toISOString(),
      };
    }

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': useKV ? 'private, s-maxage=60, stale-while-revalidate=300' : 'public, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching market data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch market data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/market
 * Update market data (future implementation)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get('section') as 'data' | 'analytics' | 'pools' | null;
    
    // For now, return not implemented
    // In the future, this could update market data in Vercel KV
    return NextResponse.json(
      { 
        error: 'Not implemented',
        message: 'Market data updates not yet supported',
        section: section || 'all',
        timestamp: new Date().toISOString(),
      },
      { status: 501 }
    );
  } catch (error) {
    console.error('Error updating market data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update market data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}