#!/usr/bin/env tsx

/**
 * Debug script to identify where inspect is hanging
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function debugInspect() {
  console.log('🔍 Debug: Starting inspect diagnostic...');
  
  try {
    console.log('✅ Step 1: Creating registry config...');
    const config = createDefaultConfig('mainnet-contract-registry');
    console.log('✅ Step 2: Config created successfully');
    
    console.log('✅ Step 3: Initializing ContractRegistry...');
    const registry = new ContractRegistry(config);
    console.log('✅ Step 4: Registry initialized successfully');
    
    console.log('✅ Step 5: Testing getStats() with timeout...');
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('getStats() timed out after 10s')), 10000)
    );
    
    const statsPromise = registry.getStats();
    const stats = await Promise.race([statsPromise, timeoutPromise]);
    
    console.log('✅ Step 6: getStats() completed successfully:', {
      totalContracts: stats.totalContracts,
      lastUpdated: stats.lastUpdated
    });
    
    console.log('✅ Step 7: Testing getHealth() with timeout...');
    const healthPromise = registry.getHealth();
    const healthTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('getHealth() timed out after 10s')), 10000)
    );
    
    const health = await Promise.race([healthPromise, healthTimeoutPromise]);
    console.log('✅ Step 8: getHealth() completed successfully:', {
      healthy: health.healthy,
      hasIssues: !!health.issues
    });
    
    console.log('🎉 All basic operations completed successfully!');
    
  } catch (error) {
    console.error('❌ Debug failed at step:', error);
    process.exit(1);
  }
}

debugInspect();