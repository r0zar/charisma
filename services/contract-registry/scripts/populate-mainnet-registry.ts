#!/usr/bin/env tsx

/**
 * Populate Mainnet Registry Script
 * 
 * Populates the contract registry with real Stacks mainnet contracts.
 * Includes comprehensive dry-run capabilities for safe production operation.
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import { isValidContractId } from '../src/utils/validators';
import { listTokens } from '@repo/tokens';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface ScriptOptions {
  dryRun: boolean;
  verbose: boolean;
  batchSize: number;
  maxContracts?: number;
  skipTokenSync: boolean;
  skipDiscovery: boolean;
}

interface ProgressUpdate {
  phase: 'token-sync' | 'discovery' | 'processing';
  message: string;
  current: number;
  total: number;
  percentage: number;
  currentContract?: string;
  batchInfo?: {
    currentBatch: number;
    totalBatches: number;
    contractsInBatch: number;
  };
}

type ProgressCallback = (update: ProgressUpdate) => void;

interface PopulationResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  contractsAdded: string[];
  contractsUpdated: string[];
  errors: { contractId: string; error: string }[];
}

interface PreviewResult {
  tokensToProcess: number;
  wellKnownContractsToProcess: number;
  discoveryContracts: number;
  totalEstimated: number;
  wouldProcess: string[];
  wouldSkip: string[];
}

// Curated list of important mainnet contracts
const WELL_KNOWN_MAINNET_CONTRACTS = [
  // Major Fungible Tokens
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
  'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token',
];

class MainnetRegistryPopulator {
  private registry: ContractRegistry;
  private options: ScriptOptions;
  private onProgress?: ProgressCallback;

  constructor(options: ScriptOptions, onProgress?: ProgressCallback) {
    this.options = options;
    this.onProgress = onProgress;

    // Initialize registry with production-appropriate config
    const config = createDefaultConfig('mainnet-contract-registry');
    config.enableAnalysis = true;
    config.enableDiscovery = true;

    this.registry = new ContractRegistry(config);
  }

  /**
   * Preview what would be processed without making changes
   */
  async preview(): Promise<PreviewResult> {
    console.log('🔍 Previewing mainnet registry population...\n');

    const result: PreviewResult = {
      tokensToProcess: 0,
      wellKnownContractsToProcess: 0,
      discoveryContracts: 0,
      totalEstimated: 0,
      wouldProcess: [],
      wouldSkip: []
    };

    // Check tokens from @repo/tokens
    if (!this.options.skipTokenSync) {
      try {
        const tokens = await listTokens();
        const validTokens = tokens.filter(token =>
          token.contractId &&
          isValidContractId(token.contractId) &&
          !this.isTestContract(token.contractId)
        );

        result.tokensToProcess = validTokens.length;
        result.wouldProcess.push(...validTokens.map(t => t.contractId));

        console.log(`📊 Token Cache Analysis:`);
        console.log(`   Total tokens in cache: ${tokens.length}`);
        console.log(`   Valid mainnet tokens: ${validTokens.length}`);
        console.log(`   Would process: ${Math.min(validTokens.length, this.options.maxContracts || Infinity)}`);
      } catch (error) {
        console.warn(`⚠️  Could not load token cache: ${error}`);
      }
    }

    // Check well-known contracts
    const validWellKnown = WELL_KNOWN_MAINNET_CONTRACTS.filter(contractId => {
      if (!isValidContractId(contractId)) {
        result.wouldSkip.push(`${contractId} (invalid format)`);
        return false;
      }
      return true;
    });

    result.wellKnownContractsToProcess = validWellKnown.length;
    result.wouldProcess.push(...validWellKnown);

    console.log(`\n📋 Well-Known Contracts Analysis:`);
    console.log(`   Curated contracts: ${WELL_KNOWN_MAINNET_CONTRACTS.length}`);
    console.log(`   Valid contracts: ${validWellKnown.length}`);
    console.log(`   Invalid contracts: ${WELL_KNOWN_MAINNET_CONTRACTS.length - validWellKnown.length}`);

    // Estimate discovery results (conservative)
    if (!this.options.skipDiscovery) {
      result.discoveryContracts = 50; // Conservative estimate
      console.log(`\n🔍 Discovery Analysis:`);
      console.log(`   Estimated additional contracts from trait discovery: ~${result.discoveryContracts}`);
    }

    // Calculate totals
    const uniqueContracts = new Set(result.wouldProcess);
    result.totalEstimated = uniqueContracts.size + result.discoveryContracts;

    console.log(`\n📊 Summary:`);
    console.log(`   Unique contracts to process: ${uniqueContracts.size}`);
    console.log(`   Estimated total after discovery: ${result.totalEstimated}`);
    console.log(`   Processing limit: ${this.options.maxContracts || 'unlimited'}`);

    if (this.options.verbose) {
      console.log(`\n📝 Detailed Contract List:`);
      Array.from(uniqueContracts).slice(0, 20).forEach(contractId => {
        console.log(`   • ${contractId}`);
      });
      if (uniqueContracts.size > 20) {
        console.log(`   ... and ${uniqueContracts.size - 20} more`);
      }
    }

    return result;
  }

  /**
   * Execute the population process
   */
  async execute(): Promise<PopulationResult> {
    console.log('🚀 Starting mainnet registry population...\n');

    const result: PopulationResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      contractsAdded: [],
      contractsUpdated: [],
      errors: []
    };

    const contractsToProcess: string[] = [];

    // Collect contracts from token cache
    if (!this.options.skipTokenSync) {
      console.log('📊 Syncing with token cache...');

      if (this.onProgress) {
        this.onProgress({
          phase: 'token-sync',
          message: 'Syncing with token cache...',
          current: 0,
          total: 100,
          percentage: 0
        });
      }

      try {
        const syncResult = await this.registry.syncWithTokenCache();

        if (this.onProgress) {
          this.onProgress({
            phase: 'token-sync',
            message: 'Token cache sync completed',
            current: 100,
            total: 100,
            percentage: 100
          });
        }
        console.log(`   Processed: ${syncResult.totalProcessed}`);
        console.log(`   Added: ${syncResult.added}`);
        console.log(`   Updated: ${syncResult.updated}`);
        console.log(`   Errors: ${syncResult.errors}`);

        result.successful += syncResult.added + syncResult.updated;
        result.failed += syncResult.errors;
        result.contractsAdded.push(...(syncResult.newContracts || []));
        result.contractsUpdated.push(...(syncResult.updatedContracts || []));
      } catch (error) {
        console.error(`❌ Token sync failed: ${error}`);
      }
    }

    // Add well-known contracts
    console.log('\n📋 Processing well-known contracts...');
    const validWellKnown = WELL_KNOWN_MAINNET_CONTRACTS.filter(isValidContractId);
    contractsToProcess.push(...validWellKnown);

    // Process contracts in batches
    await this.processBatch(contractsToProcess, result);

    // Discovery phase
    if (!this.options.skipDiscovery) {
      console.log('\n🔍 Running contract discovery...');
      try {
        const discoveryResult = await this.registry.discoverNewContracts();
        console.log(`   Discovery successful: ${discoveryResult.success}`);
        console.log(`   Contracts found: ${discoveryResult.totalContractsFound}`);
        console.log(`   Contracts added: ${discoveryResult.totalContractsAdded}`);

        result.successful += discoveryResult.totalContractsAdded;
        if (discoveryResult.results) {
          discoveryResult.results.forEach(dr => {
            result.contractsAdded.push(...dr.newContracts);
          });
        }
      } catch (error) {
        console.error(`❌ Discovery failed: ${error}`);
        result.errors.push({ contractId: 'discovery', error: String(error) });
      }
    }

    return result;
  }

  /**
   * Process contracts in batches
   */
  private async processBatch(contracts: string[], result: PopulationResult): Promise<void> {
    const limitedContracts = this.options.maxContracts
      ? contracts.slice(0, this.options.maxContracts)
      : contracts;

    console.log(`   Processing ${limitedContracts.length} contracts in batches of ${this.options.batchSize}...`);

    const totalBatches = Math.ceil(limitedContracts.length / this.options.batchSize);

    for (let i = 0; i < limitedContracts.length; i += this.options.batchSize) {
      const batch = limitedContracts.slice(i, i + this.options.batchSize);
      const currentBatch = Math.floor(i / this.options.batchSize) + 1;
      console.log(`   Batch ${currentBatch}: ${batch.length} contracts`);

      for (let j = 0; j < batch.length; j++) {
        const contractId = batch[j];
        const overall = i + j + 1;

        // Send progress update
        if (this.onProgress) {
          this.onProgress({
            phase: 'processing',
            message: `Processing contract ${overall} of ${limitedContracts.length}`,
            current: overall,
            total: limitedContracts.length,
            percentage: Math.round((overall / limitedContracts.length) * 100),
            currentContract: contractId,
            batchInfo: {
              currentBatch,
              totalBatches,
              contractsInBatch: batch.length
            }
          });
        }
        try {
          const addResult = await this.registry.addContract(contractId);

          if (addResult.success) {
            result.successful++;
            if (addResult.wasExisting) {
              result.contractsUpdated.push(contractId);
            } else {
              result.contractsAdded.push(contractId);
            }

            if (this.options.verbose) {
              console.log(`     ✅ ${contractId} ${addResult.wasExisting ? '(updated)' : '(added)'}`);
            }
          } else {
            result.failed++;
            result.errors.push({ contractId, error: addResult.error || 'Unknown error' });
            console.log(`     ❌ ${contractId}: ${addResult.error}`);
          }
        } catch (error) {
          result.failed++;
          result.errors.push({ contractId, error: String(error) });
          console.log(`     ❌ ${contractId}: ${error}`);
        }

        result.totalProcessed++;
      }

      // Rate limiting between batches
      if (i + this.options.batchSize < limitedContracts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Check if a contract ID appears to be a test contract
   */
  private isTestContract(contractId: string): boolean {
    const testPatterns = [
      /test/i,
      /dummy/i,
      /fake/i,
      /mock/i,
      /example/i,
      /SP123/,
      /SP000/
    ];

    return testPatterns.some(pattern => pattern.test(contractId));
  }

  /**
   * Generate final summary
   */
  generateSummary(result: PopulationResult | PreviewResult, isDryRun: boolean): void {
    console.log(`\n📊 ${isDryRun ? 'PREVIEW' : 'EXECUTION'} SUMMARY`);
    console.log('='.repeat(50));

    if ('totalProcessed' in result) {
      // Execution result
      console.log(`Total processed: ${result.totalProcessed}`);
      console.log(`Successful: ${result.successful}`);
      console.log(`Failed: ${result.failed}`);
      console.log(`Contracts added: ${result.contractsAdded.length}`);
      console.log(`Contracts updated: ${result.contractsUpdated.length}`);

      if (result.errors.length > 0) {
        console.log(`\n❌ Errors (${result.errors.length}):`);
        result.errors.slice(0, 10).forEach(error => {
          console.log(`   • ${error.contractId}: ${error.error}`);
        });
        if (result.errors.length > 10) {
          console.log(`   ... and ${result.errors.length - 10} more errors`);
        }
      }
    } else {
      // Preview result
      console.log(`Would process tokens: ${result.tokensToProcess}`);
      console.log(`Would process well-known contracts: ${result.wellKnownContractsToProcess}`);
      console.log(`Estimated discovery contracts: ${result.discoveryContracts}`);
      console.log(`Total estimated: ${result.totalEstimated}`);
    }

    console.log(`\n💡 NEXT STEPS:`);
    if (isDryRun) {
      console.log('   1. Review the preview above');
      console.log('   2. Run with --execute to perform actual population');
      console.log('   3. Use npm run script:inspect-mainnet to check results');
    } else {
      console.log('   1. Run npm run script:inspect-mainnet to verify results');
      console.log('   2. Run npm run script:audit-data to check data integrity');
      console.log('   3. Generate reports with npm run script:generate-report');
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: ScriptOptions = {
    dryRun: !args.includes('--execute'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '10'),
    maxContracts: args.find(arg => arg.startsWith('--max-contracts='))?.split('=')[1]
      ? parseInt(args.find(arg => arg.startsWith('--max-contracts='))!.split('=')[1])
      : undefined,
    skipTokenSync: args.includes('--skip-token-sync'),
    skipDiscovery: args.includes('--skip-discovery')
  };

  console.log('🏗️  MAINNET CONTRACT REGISTRY POPULATION');
  console.log('='.repeat(50));
  console.log(`Mode: ${options.dryRun ? 'DRY-RUN (Preview Only)' : 'EXECUTION'}`);
  console.log(`Batch size: ${options.batchSize}`);
  console.log(`Max contracts: ${options.maxContracts || 'unlimited'}`);
  console.log(`Token sync: ${options.skipTokenSync ? 'DISABLED' : 'enabled'}`);
  console.log(`Discovery: ${options.skipDiscovery ? 'DISABLED' : 'enabled'}`);
  console.log();

  try {
    const progressCallback: ProgressCallback = (update) => {
      const progressBar = '█'.repeat(Math.round(update.percentage / 5)) + '░'.repeat(20 - Math.round(update.percentage / 5));
      console.log(`[${progressBar}] ${update.percentage}% - ${update.message}`);
      
      if (update.currentContract) {
        console.log(`   Current: ${update.currentContract}`);
      }
      
      if (update.batchInfo) {
        console.log(`   Batch: ${update.batchInfo.currentBatch}/${update.batchInfo.totalBatches} (${update.batchInfo.contractsInBatch} contracts)`);
      }
    };

    const populator = new MainnetRegistryPopulator(options, progressCallback);

    if (options.dryRun) {
      console.log('📋 Analyzing contracts to process...');
      const previewResult = await populator.preview();
      populator.generateSummary(previewResult, true);
    } else {
      console.log('⚠️  WARNING: Making changes to the registry!');
      console.log('🚀 Starting contract population...');
      const executionResult = await populator.execute();
      populator.generateSummary(executionResult, false);
    }

    console.log('\n🎉 Script completed successfully!');
  } catch (err) {
    console.error('\n💥 Script failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Script interrupted by user');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught exception:', error);
  process.exit(1);
});

// Execute the script
main();