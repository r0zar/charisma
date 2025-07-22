import { NextRequest, NextResponse } from 'next/server';
import { historicalBalanceService } from '@/services/historical-balance-service';
import { generateCacheHeaders } from '@/lib/cache-strategy';

export const runtime = 'edge';

/**
 * GET /api/v1/balances/known-addresses - Get list of known addresses being tracked
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[Known Addresses API] Getting known addresses...');

    const knownAddresses = await historicalBalanceService.getKnownAddresses();
    const stats = await historicalBalanceService.getStats();

    const result = {
      message: 'Known addresses being tracked for balance history',
      addresses: knownAddresses,
      count: knownAddresses.length,
      statistics: stats,
      endpoints: {
        historical: '/api/v1/balances/historical',
        singleAddress: '/api/v1/balances/historical?address=SP...',
        bulkAddresses: '/api/v1/balances/historical?addresses=SP1...,SP2...'
      }
    };

    // Generate cache headers
    const cacheHeaders = generateCacheHeaders(
      { sMaxAge: 300, staleWhileRevalidate: 900, browserCache: 120 }, // 5 minutes
      { deploymentId: process.env.VERCEL_DEPLOYMENT_ID }
    );

    const processingTime = Date.now() - startTime;
    cacheHeaders.set('X-Response-Time', `${processingTime}ms`);
    cacheHeaders.set('X-Address-Count', knownAddresses.length.toString());

    console.log(`[Known Addresses API] Returning ${knownAddresses.length} addresses in ${processingTime}ms`);

    return NextResponse.json(result, { headers: cacheHeaders });

  } catch (error) {
    console.error('[Known Addresses API] Error:', error);

    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to get known addresses',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/balances/known-addresses - Update list of known addresses to track
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify admin authentication (you might want to add proper auth here)
    const authHeader = request.headers.get('Authorization');
    const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET || 'dev-admin-secret';
    
    if (authHeader !== `Bearer ${adminSecret}`) {
      console.warn('[Known Addresses API] Unauthorized update request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const addresses = body.addresses;

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { error: 'addresses array is required' },
        { status: 400 }
      );
    }

    // Validate addresses (basic validation)
    const validAddresses = addresses.filter(addr => 
      typeof addr === 'string' && 
      addr.length > 0 && 
      (addr.startsWith('SP') || addr.startsWith('ST') || addr.startsWith('SM'))
    );

    if (validAddresses.length === 0) {
      return NextResponse.json(
        { error: 'No valid Stacks addresses provided' },
        { status: 400 }
      );
    }

    console.log(`[Known Addresses API] Updating known addresses with ${validAddresses.length} addresses`);

    await historicalBalanceService.updateKnownAddresses(validAddresses);

    const processingTime = Date.now() - startTime;

    const result = {
      success: true,
      message: 'Known addresses updated successfully',
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      updated: {
        total: validAddresses.length,
        addresses: validAddresses
      },
      ignored: {
        total: addresses.length - validAddresses.length,
        invalid: addresses.filter(addr => !validAddresses.includes(addr))
      }
    };

    console.log(`[Known Addresses API] Updated known addresses in ${processingTime}ms`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Known Addresses API] Update error:', error);

    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to update known addresses',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`
      },
      { status: 500 }
    );
  }
}