#!/usr/bin/env tsx

/**
 * Fast Token Cache Sync Script
 * 
 * Optimized version with concurrency and 20-minute timeout
 */

import { ContractRegistry, createDefaultConfig, type ContractRegistryConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

/**
 * Process tokens in parallel batches for faster execution
 */
async function syncTokenCacheFast() {
  console.log('🚀 FAST TOKEN CACHE SYNC');
  console.log('==================================================');
  console.log('⚙️ Initializing contract registry...');

  const config = createDefaultConfig();
  const registry = new ContractRegistry(config);

  try {
    const { listTokens } = await import('@repo/tokens');
    const tokens = await listTokens();
    
    console.log(`🔄 Starting fast sync with ${tokens.length} tokens from @repo/tokens`);
    console.log('🚀 Using parallel processing with concurrency control...\n');
    
    let processed = 0;
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    const BATCH_SIZE = 10; // Process 10 tokens at once
    const MAX_RETRIES = 2;
    
    // Process tokens in batches
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (token) => {
        const contractId = token.contractId;
        
        if (!contractId || !contractId.includes('.')) {
          return { result: 'skipped', contractId: contractId || 'invalid' };
        }

        let attempts = 0;
        while (attempts <= MAX_RETRIES) {
          try {
            // Check if contract exists
            const existing = await registry.getContract(contractId);
            
            if (existing) {
              // Update existing contract with token metadata
              await registry.updateContract(contractId, {
                tokenMetadata: token,
                lastUpdated: Date.now()
              });
              return { result: 'updated', contractId };
            } else {
              // Add new contract (this will do full analysis + metadata)
              await registry.addContract(contractId);
              return { result: 'added', contractId };
            }
          } catch (error: any) {
            attempts++;
            if (attempts > MAX_RETRIES) {
              // Skip contracts that consistently fail (404, etc.)
              if (error.message?.includes('404') || error.message?.includes('cannot find contract')) {
                return { result: 'skipped', contractId, error: 'Contract not found on-chain' };
              }
              return { result: 'error', contractId, error: error.message };
            }
            // Brief delay before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      for (const result of batchResults) {
        processed++;
        if (result.status === 'fulfilled') {
          const { result: outcome, contractId, error } = result.value;
          switch (outcome) {
            case 'added':
              added++;
              break;
            case 'updated':
              updated++;
              break;
            case 'skipped':
              skipped++;
              break;
            case 'error':
              errors++;
              console.log(`❌ Error processing ${contractId}: ${error}`);
              break;
          }
        } else {
          errors++;
          console.log(`❌ Promise rejected: ${result.reason}`);
        }
        
        // Progress update
        const percentage = Math.floor((processed / tokens.length) * 100);
        const progressBar = createProgressBar(processed, tokens.length);
        process.stdout.write(`\r${progressBar} ${percentage}% - ✅${added} 📝${updated} ⏭️${skipped} ❌${errors}`);
      }
      
      // Small delay between batches to be nice to APIs
      if (i + BATCH_SIZE < tokens.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('\n\n✅ SYNC COMPLETED!');
    console.log('==================================================');
    console.log(`📊 Final Results:`);
    console.log(`   📝 Added: ${added} contracts`);
    console.log(`   🔄 Updated: ${updated} contracts`);
    console.log(`   ⏭️  Skipped: ${skipped} contracts`);
    console.log(`   ❌ Errors: ${errors} contracts`);
    console.log(`   🕒 Total processed: ${processed}/${tokens.length}`);
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

/**
 * Create a simple progress bar
 */
function createProgressBar(current: number, total: number, width: number = 40): string {
  const percentage = Math.floor((current / total) * 100);
  const filledWidth = Math.floor((current / total) * width);
  const emptyWidth = width - filledWidth;
  
  const filled = '█'.repeat(filledWidth);
  const empty = '░'.repeat(emptyWidth);
  
  return `[${filled}${empty}]`;
}

// Check for dry-run flag
const isDryRun = process.argv.includes('--dry-run');
const isVerbose = process.argv.includes('--verbose');

if (isDryRun) {
  console.log('🔍 DRY RUN MODE: No changes will be made\n');
  console.log('Found tokens in @repo/tokens cache - sync would process them in parallel batches.');
  console.log('Use without --dry-run to perform the fast sync.');
} else {
  // Set timeout to 20 minutes (1200 seconds)
  const timeout = setTimeout(() => {
    console.log('\n⏰ Sync timed out after 20 minutes');
    process.exit(1);
  }, 20 * 60 * 1000);

  syncTokenCacheFast()
    .then(() => {
      clearTimeout(timeout);
      process.exit(0);
    })
    .catch((error) => {
      clearTimeout(timeout);
      console.error('❌ Fast sync failed:', error);
      process.exit(1);
    });
}