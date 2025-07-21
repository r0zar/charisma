import { NextRequest, NextResponse } from 'next/server';
import { createDefaultConfig, ContractRegistry } from '@services/contract-registry';

/**
 * Vercel Cron Job - Daily Contract Registry Consolidation
 * 
 * This endpoint performs daily consolidation of all contract metadata into a single blob
 * for optimized performance and backup purposes.
 * 
 * Triggers: 
 * - Vercel cron (daily at 02:00 UTC)
 * - Manual calls with proper authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    
    // Check for Vercel cron secret
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Cron/Consolidate] Unauthorized request attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron/Consolidate] Starting daily consolidation process...');
    const startTime = Date.now();

    // Initialize registry service
    const config = createDefaultConfig('contract-registry');
    const registry = new ContractRegistry(config);

    // Get the consolidated blob manager
    const consolidatedManager = registry.getBlobStorage().getConsolidatedBlobManager();

    // Check if consolidation is actually needed
    const isNeeded = await consolidatedManager.isConsolidationNeeded();
    if (!isNeeded) {
      console.log('[Cron/Consolidate] Consolidation not needed, skipping');
      return NextResponse.json({
        success: true,
        message: 'Consolidation not needed',
        skipped: true,
        checkedAt: new Date().toISOString()
      });
    }

    // Perform the consolidation
    const result = await consolidatedManager.consolidate();
    const totalTime = Date.now() - startTime;

    if (result.success) {
      console.log(`[Cron/Consolidate] Successfully consolidated ${result.contractCount} contracts in ${totalTime}ms`);
      
      return NextResponse.json({
        success: true,
        message: `Successfully consolidated ${result.contractCount} contracts`,
        contractCount: result.contractCount,
        generationTimeMs: result.generationTimeMs,
        totalTimeMs: totalTime,
        completedAt: new Date().toISOString()
      });
    } else {
      console.error(`[Cron/Consolidate] Failed to consolidate: ${result.error}`);
      
      return NextResponse.json({
        success: false,
        error: result.error,
        contractCount: result.contractCount,
        totalTimeMs: totalTime,
        failedAt: new Date().toISOString()
      }, { status: 500 });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Cron/Consolidate] Unexpected error:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: `Consolidation failed: ${errorMessage}`,
      failedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Health check endpoint for monitoring
 */
export async function GET() {
  try {
    const config = createDefaultConfig('contract-registry');
    const registry = new ContractRegistry(config);
    const consolidatedManager = registry.getBlobStorage().getConsolidatedBlobManager();

    // Load the current consolidated blob to check health
    const existing = await consolidatedManager.loadConsolidatedBlob();
    const isNeeded = await consolidatedManager.isConsolidationNeeded();

    return NextResponse.json({
      healthy: true,
      consolidatedBlobExists: !!existing,
      lastConsolidation: existing?.generatedAt ? new Date(existing.generatedAt).toISOString() : null,
      contractCount: existing?.contractCount || 0,
      consolidationNeeded: isNeeded,
      checkedAt: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json({
      healthy: false,
      error: errorMessage,
      checkedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Only allow POST and GET methods
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, POST',
      'Cache-Control': 'no-cache'
    }
  });
}