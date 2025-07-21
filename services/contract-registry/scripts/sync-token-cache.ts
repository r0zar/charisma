#!/usr/bin/env tsx

/**
 * Token Cache Sync Script
 * 
 * Simple script to sync with token cache and show progress for each token processed.
 */

import { ContractRegistry, createDefaultConfig, type ContractRegistryConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  currentToken: string;
  action: 'processing' | 'added' | 'updated' | 'skipped' | 'error';
  message?: string;
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
  
  return `[${filled}${empty}] ${percentage}% (${current}/${total})`;
}

/**
 * Enhanced ContractRegistry with progress callbacks
 */
class ProgressContractRegistry extends ContractRegistry {
  private onProgress?: (progress: ProgressInfo) => void;

  constructor(config: ContractRegistryConfig, onProgress?: (progress: ProgressInfo) => void) {
    super(config);
    this.onProgress = onProgress;
  }

  async syncWithTokenCache() {
    const startTime = Date.now();

    try {
      // Get all tokens from the token cache
      const { listTokens } = await import('@repo/tokens');
      const tokens = await listTokens();
      
      console.log(`🔄 Starting sync with ${tokens.length} tokens from @repo/tokens`);
      
      let added = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;
      const newContracts: string[] = [];
      const updatedContracts: string[] = [];
      const errorContracts: { contractId: string; error: string }[] = [];

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const current = i + 1;
        
        // Report progress for current token
        if (this.onProgress) {
          this.onProgress({
            current,
            total: tokens.length,
            percentage: Math.floor((current / tokens.length) * 100),
            currentToken: token.contractId || 'unknown',
            action: 'processing'
          });
        }

        if (!token.contractId || !token.contractId.includes('.')) {
          skipped++;
          if (this.onProgress) {
            this.onProgress({
              current,
              total: tokens.length,
              percentage: Math.floor((current / tokens.length) * 100),
              currentToken: token.contractId || 'invalid',
              action: 'skipped',
              message: 'Invalid contract ID format'
            });
          }
          continue;
        }

        try {
          const existingContract = await this.getContract(token.contractId);
          
          if (!existingContract) {
            // Add new contract
            const result = await this.addContract(token.contractId);
            if (result.success) {
              added++;
              newContracts.push(token.contractId);
              if (this.onProgress) {
                this.onProgress({
                  current,
                  total: tokens.length,
                  percentage: Math.floor((current / tokens.length) * 100),
                  currentToken: token.contractId,
                  action: 'added'
                });
              }
            } else {
              errors++;
              errorContracts.push({ contractId: token.contractId, error: result.error || 'Unknown error' });
              if (this.onProgress) {
                this.onProgress({
                  current,
                  total: tokens.length,
                  percentage: Math.floor((current / tokens.length) * 100),
                  currentToken: token.contractId,
                  action: 'error',
                  message: result.error || 'Unknown error'
                });
              }
            }
          } else {
            // Update existing contract with token metadata
            const result = await this.updateContract(token.contractId, {
              tokenMetadata: token,
              lastUpdated: Date.now()
            });
            if (result.success) {
              updated++;
              updatedContracts.push(token.contractId);
              if (this.onProgress) {
                this.onProgress({
                  current,
                  total: tokens.length,
                  percentage: Math.floor((current / tokens.length) * 100),
                  currentToken: token.contractId,
                  action: 'updated'
                });
              }
            } else {
              errors++;
              errorContracts.push({ contractId: token.contractId, error: result.error || 'Unknown error' });
              if (this.onProgress) {
                this.onProgress({
                  current,
                  total: tokens.length,
                  percentage: Math.floor((current / tokens.length) * 100),
                  currentToken: token.contractId,
                  action: 'error',
                  message: result.error || 'Unknown error'
                });
              }
            }
          }
        } catch (error) {
          errors++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          errorContracts.push({ contractId: token.contractId, error: errorMessage });
          if (this.onProgress) {
            this.onProgress({
              current,
              total: tokens.length,
              percentage: Math.floor((current / tokens.length) * 100),
              currentToken: token.contractId,
              action: 'error',
              message: errorMessage
            });
          }
        }
      }

      return {
        success: true,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        source: '@repo/tokens',
        totalProcessed: tokens.length,
        added,
        updated,
        skipped,
        errors,
        newContracts,
        updatedContracts,
        errorContracts
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        source: '@repo/tokens',
        totalProcessed: 0,
        added: 0,
        updated: 0,
        skipped: 0,
        errors: 1,
        error: errorMessage
      };
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🪙 TOKEN CACHE SYNC');
  console.log('='.repeat(50));

  // Parse command line arguments
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const dryRun = args.includes('--dry-run') || args.includes('--dry');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: tsx sync-token-cache.ts [options]

Options:
  --verbose, -v     Show detailed progress information
  --dry-run, --dry  Show what would be synced without making changes
  --help, -h        Show this help message
`);
    process.exit(0);
  }

  try {
    console.log('⚙️ Initializing contract registry...');
    
    // Initialize registry
    const config = createDefaultConfig('mainnet-contract-registry');
    
    // Progress callback function
    const onProgress = (progress: ProgressInfo) => {
      const progressBar = createProgressBar(progress.current, progress.total);
      const actionEmoji = {
        'processing': '🔄',
        'added': '✅',
        'updated': '📝',
        'skipped': '⏭️',
        'error': '❌'
      }[progress.action];

      // Clear the current line and show progress
      process.stdout.write('\r\x1b[K');
      
      if (progress.action === 'processing') {
        process.stdout.write(`${progressBar} ${actionEmoji} ${progress.currentToken}`);
      } else {
        const message = progress.message ? ` (${progress.message.substring(0, 30)})` : '';
        if (verbose) {
          // In verbose mode, show completed actions on new lines but keep processing on same line
          process.stdout.write(`${progressBar} ${actionEmoji} ${progress.currentToken}${message}\n`);
        } else {
          // In non-verbose mode, always update in place
          process.stdout.write(`${progressBar} ${actionEmoji} Last: ${progress.currentToken.split('.').pop() || progress.currentToken}`);
        }
      }
    };

    const registry = new ProgressContractRegistry(config, onProgress);
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE: No changes will be made');
      console.log('');
      
      // Just show what tokens exist
      const { listTokens } = await import('@repo/tokens');
      const tokens = await listTokens();
      
      console.log(`Found ${tokens.length} tokens in @repo/tokens cache:`);
      tokens.slice(0, 10).forEach((token, i) => {
        console.log(`  ${i + 1}. ${token.contractId || 'invalid'} - ${token.name || 'unnamed'}`);
      });
      
      if (tokens.length > 10) {
        console.log(`  ... and ${tokens.length - 10} more tokens`);
      }
      
      console.log('\nUse without --dry-run to perform the sync.');
      process.exit(0);
    }

    console.log('🔄 Starting token cache sync...\n');
    
    const result = await registry.syncWithTokenCache();
    
    // Clear progress line and show final results
    process.stdout.write('\r\x1b[K');
    console.log('\n📊 SYNC RESULTS');
    console.log('='.repeat(50));
    console.log(`✅ Success: ${result.success}`);
    console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`📦 Total Processed: ${result.totalProcessed}`);
    console.log(`➕ Added: ${result.added}`);
    console.log(`📝 Updated: ${result.updated}`);
    console.log(`⏭️  Skipped: ${result.skipped}`);
    console.log(`❌ Errors: ${result.errors}`);

    if (result.newContracts && result.newContracts.length > 0 && verbose) {
      console.log(`\n➕ New contracts added:`);
      result.newContracts.slice(0, 10).forEach(contractId => {
        console.log(`  • ${contractId}`);
      });
      if (result.newContracts.length > 10) {
        console.log(`  ... and ${result.newContracts.length - 10} more`);
      }
    }

    if (result.updatedContracts && result.updatedContracts.length > 0 && verbose) {
      console.log(`\n📝 Updated contracts:`);
      result.updatedContracts.slice(0, 10).forEach(contractId => {
        console.log(`  • ${contractId}`);
      });
      if (result.updatedContracts.length > 10) {
        console.log(`  ... and ${result.updatedContracts.length - 10} more`);
      }
    }

    if (result.errorContracts && result.errorContracts.length > 0) {
      console.log(`\n❌ Error contracts:`);
      result.errorContracts.slice(0, 5).forEach(({ contractId, error }) => {
        console.log(`  • ${contractId}: ${error}`);
      });
      if (result.errorContracts.length > 5) {
        console.log(`  ... and ${result.errorContracts.length - 5} more errors`);
      }
    }

    if (!result.success) {
      console.log(`\n❌ Sync failed: ${result.error || 'Unknown error'}`);
      process.exit(1);
    }

    console.log('\n🎉 Token cache sync completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️ Sync interrupted by user');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});