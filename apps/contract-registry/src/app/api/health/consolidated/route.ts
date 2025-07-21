import { NextResponse } from 'next/server';
import { createDefaultConfig, ContractRegistry } from '@services/contract-registry';

/**
 * Health check endpoint for consolidated blob system
 * Monitors the status of the consolidated blob architecture
 */
export async function GET() {
  try {
    const startTime = Date.now();
    
    // Initialize registry service
    const config = createDefaultConfig('contract-registry');
    const registry = new ContractRegistry(config);
    const consolidatedManager = registry.getBlobStorage().getConsolidatedBlobManager();

    // Check consolidated blob status
    const [consolidatedBlob, isNeeded] = await Promise.all([
      consolidatedManager.loadConsolidatedBlob(),
      consolidatedManager.isConsolidationNeeded()
    ]);

    const responseTime = Date.now() - startTime;
    const now = Date.now();

    // Calculate health metrics
    const health = {
      status: 'healthy' as 'healthy' | 'warning' | 'error',
      responseTimeMs: responseTime,
      checkedAt: new Date(now).toISOString(),
      consolidatedBlob: {
        exists: !!consolidatedBlob,
        contractCount: consolidatedBlob?.contractCount || 0,
        version: consolidatedBlob?.version || 'none',
        generatedAt: consolidatedBlob?.generatedAt ? new Date(consolidatedBlob.generatedAt).toISOString() : null,
        lastFullRebuild: consolidatedBlob?.metadata?.lastFullRebuild ? new Date(consolidatedBlob.metadata.lastFullRebuild).toISOString() : null,
        ageHours: consolidatedBlob?.generatedAt ? Math.round((now - consolidatedBlob.generatedAt) / (1000 * 60 * 60)) : null,
        sizeKB: consolidatedBlob?.metadata?.totalSize ? Math.round(consolidatedBlob.metadata.totalSize / 1024) : null
      },
      consolidation: {
        needed: isNeeded,
        lastCheck: new Date(now).toISOString()
      },
      issues: [] as string[]
    };

    // Check for potential issues
    if (!consolidatedBlob) {
      health.status = 'warning';
      health.issues.push('No consolidated blob exists');
    } else {
      const ageHours = health.consolidatedBlob.ageHours || 0;
      
      if (ageHours > 48) {
        health.status = 'warning';
        health.issues.push(`Consolidated blob is ${ageHours}h old (>48h)`);
      } else if (ageHours > 72) {
        health.status = 'error';
        health.issues.push(`Consolidated blob is very old: ${ageHours}h (>72h)`);
      }

      if (isNeeded) {
        health.status = health.status === 'error' ? 'error' : 'warning';
        health.issues.push('Consolidation is needed but not yet performed');
      }

      if (health.consolidatedBlob.contractCount === 0) {
        health.status = 'warning';
        health.issues.push('Consolidated blob contains no contracts');
      }
    }

    if (responseTime > 5000) {
      health.status = health.status === 'error' ? 'error' : 'warning';
      health.issues.push(`Slow response time: ${responseTime}ms (>5s)`);
    }

    // Set appropriate HTTP status
    const httpStatus = health.status === 'error' ? 500 : health.status === 'warning' ? 200 : 200;

    return NextResponse.json(health, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json({
      status: 'error',
      error: `Health check failed: ${errorMessage}`,
      checkedAt: new Date().toISOString(),
      consolidatedBlob: {
        exists: false,
        contractCount: 0,
        error: errorMessage
      },
      consolidation: {
        needed: null,
        error: errorMessage
      },
      issues: ['Health check system failure']
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}