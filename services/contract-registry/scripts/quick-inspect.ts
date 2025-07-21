#!/usr/bin/env tsx

/**
 * Quick inspect script without React - for testing fixes
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

/**
 * Timeout wrapper for async operations
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

async function quickInspect() {
  console.log('🔍 Quick inspect starting...');
  
  try {
    console.log('📊 Generating system overview...');
    
    const config = createDefaultConfig('mainnet-contract-registry');
    const registry = new ContractRegistry(config);
    
    try {
      // Try to get basic stats with short timeout
      console.log('   Fetching registry stats (with 5s timeout)...');
      const stats = await withTimeout(registry.getStats(), 5000);
      console.log('   ✅ Stats retrieved successfully:', {
        totalContracts: stats.totalContracts,
        lastUpdated: stats.lastUpdated
      });
      
      console.log('   Checking registry health (with 5s timeout)...');
      const health = await withTimeout(registry.getHealth(), 5000);
      console.log('   ✅ Health check completed:', {
        healthy: health.healthy,
        hasIssues: !!health.issues
      });
      
      console.log('🎉 Quick inspect completed successfully!');
      
    } catch (error) {
      console.error('❌ Registry operations failed:', error);
      console.log('   Falling back to storage layer checks...');
      
      // Fallback: try to get basic info from storage layer directly
      try {
        const { IndexManager } = await import('../src/storage/IndexManager');
        const fallbackIndexManager = new IndexManager({
          serviceName: 'mainnet-contract-registry',
          keyPrefix: 'mainnet-contract-registry:',
          indexTTL: 86400
        });
        const indexStats = await withTimeout(fallbackIndexManager.getStats(), 3000);
        console.log('   ✅ Retrieved index stats as fallback:', indexStats);
        
        console.log('🟡 Quick inspect completed with fallback mode');
        
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        console.log('🔴 Quick inspect failed completely');
      }
    }
    
  } catch (error) {
    console.error('❌ Quick inspect initialization failed:', error);
    process.exit(1);
  }
}

quickInspect();