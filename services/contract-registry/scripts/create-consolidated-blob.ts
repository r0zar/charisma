#!/usr/bin/env tsx

/**
 * Create Consolidated Blob Script
 * 
 * This script creates the first consolidated blob from all existing contract metadata.
 * It consolidates all individual contract blobs into a single optimized blob for 
 * improved performance and reduced API calls.
 * 
 * Usage:
 *   npm run script -- scripts/create-consolidated-blob.ts [--force] [--verbose]
 * 
 * Options:
 *   --force    Force creation even if consolidated blob already exists
 *   --verbose  Show detailed progress information
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface ScriptOptions {
  force: boolean;
  verbose: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  
  return {
    force: args.includes('--force'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };
}

/**
 * Format file size in human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration in human readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Main script execution
 */
async function main() {
  const options = parseArgs();
  
  console.log('🔧 CONSOLIDATED BLOB CREATION SCRIPT');
  console.log('='.repeat(50));
  console.log(`Force mode: ${options.force ? 'ON' : 'OFF'}`);
  console.log(`Verbose mode: ${options.verbose ? 'ON' : 'OFF'}`);
  console.log();

  const totalStartTime = Date.now();

  try {
    // Initialize the registry
    console.log('🔄 Initializing contract registry...');
    const config = createDefaultConfig('contract-registry');
    const registry = new ContractRegistry(config);
    
    // Get the consolidated blob manager
    const consolidatedManager = registry.getBlobStorage().getConsolidatedBlobManager();

    // Check if consolidated blob already exists
    console.log('🔍 Checking for existing consolidated blob...');
    const existing = await consolidatedManager.loadConsolidatedBlob();
    
    if (existing && !options.force) {
      console.log('✅ Consolidated blob already exists!');
      console.log(`   📊 Contract count: ${existing.contractCount.toLocaleString()}`);
      console.log(`   📅 Generated: ${new Date(existing.generatedAt).toLocaleString()}`);
      console.log(`   📏 Size: ${formatBytes(existing.metadata?.totalSize || 0)}`);
      console.log(`   ⏱️  Generation time: ${formatDuration(existing.metadata?.generationTimeMs || 0)}`);
      console.log();
      console.log('💡 Use --force flag to recreate the consolidated blob');
      return;
    }

    if (existing && options.force) {
      console.log('⚠️  Existing consolidated blob found, but --force flag specified');
      console.log(`   📊 Existing contract count: ${existing.contractCount.toLocaleString()}`);
      console.log(`   📅 Existing generation date: ${new Date(existing.generatedAt).toLocaleString()}`);
      console.log('   🔄 Proceeding with forced recreation...');
      console.log();
    }

    // Check if consolidation is needed
    console.log('🔍 Checking consolidation requirements...');
    const isNeeded = await consolidatedManager.isConsolidationNeeded();
    
    if (!isNeeded && !options.force) {
      console.log('✅ Consolidation not needed at this time');
      console.log('💡 Use --force flag to create consolidated blob anyway');
      return;
    }

    // Start the consolidation process
    console.log('🚀 Starting consolidated blob creation...');
    console.log();

    const consolidationStartTime = Date.now();

    // Get some stats before we start
    if (options.verbose) {
      try {
        const stats = await registry.getStats();
        console.log('📊 Current registry stats:');
        console.log(`   Total contracts: ${stats.totalContracts.toLocaleString()}`);
        console.log(`   By type: Token=${stats.contractsByType.token}, NFT=${stats.contractsByType.nft}, Vault=${stats.contractsByType.vault}, Unknown=${stats.contractsByType.unknown}`);
        console.log(`   Cache hit rate: ${stats.cacheHitRate.toFixed(1)}%`);
        console.log();
      } catch (error) {
        console.warn('⚠️  Could not retrieve registry stats:', error);
      }
    }

    // Perform the consolidation
    console.log('⏳ Generating consolidated blob...');
    const result = await consolidatedManager.consolidate();

    const totalTime = Date.now() - totalStartTime;
    const consolidationTime = Date.now() - consolidationStartTime;

    console.log();

    if (result.success) {
      console.log('🎉 CONSOLIDATED BLOB CREATED SUCCESSFULLY!');
      console.log('='.repeat(50));
      console.log(`📊 Contracts consolidated: ${result.contractCount.toLocaleString()}`);
      console.log(`⏱️  Generation time: ${formatDuration(result.generationTimeMs)}`);
      console.log(`⏱️  Total script time: ${formatDuration(totalTime)}`);
      console.log(`📅 Created at: ${new Date().toLocaleString()}`);

      // Try to get additional info about the created blob
      try {
        const created = await consolidatedManager.loadConsolidatedBlob();
        if (created) {
          console.log(`📏 Blob size: ${formatBytes(created.metadata?.totalSize || 0)}`);
          console.log(`🗜️  Compression ratio: ${(created.metadata?.compressionRatio * 100 || 30).toFixed(1)}%`);
          console.log(`📋 Version: ${created.version}`);
          
          if (options.verbose) {
            // Show breakdown by contract type
            const typeBreakdown: Record<string, number> = {
              token: 0,
              nft: 0,
              vault: 0,
              unknown: 0
            };
            
            for (const metadata of Object.values(created.contracts)) {
              const typed = metadata as any;
              typeBreakdown[typed.contractType] = (typeBreakdown[typed.contractType] || 0) + 1;
            }
            
            console.log();
            console.log('📈 Contract type breakdown:');
            Object.entries(typeBreakdown).forEach(([type, count]) => {
              console.log(`   ${type}: ${count.toLocaleString()}`);
            });
          }
        }
      } catch (error) {
        console.warn('⚠️  Could not retrieve blob details:', error);
      }

      console.log();
      console.log('✅ Consolidated blob is now available for:');
      console.log('   • Faster bulk token/NFT queries');  
      console.log('   • Reduced blob storage API calls');
      console.log('   • Better cache performance');
      console.log('   • Daily automated backups via cron');
      
    } else {
      console.log('❌ CONSOLIDATED BLOB CREATION FAILED');
      console.log('='.repeat(50));
      console.log(`Error: ${result.error}`);
      console.log(`⏱️  Time before failure: ${formatDuration(consolidationTime)}`);
      console.log();
      console.log('🔍 Troubleshooting steps:');
      console.log('1. Check your BLOB_BASE_URL environment variable');
      console.log('2. Verify blob storage permissions');
      console.log('3. Check network connectivity');
      console.log('4. Review the error message above for specific issues');
      
      process.exit(1);
    }

  } catch (error) {
    const totalTime = Date.now() - totalStartTime;
    console.error('💥 SCRIPT FAILED');
    console.error('='.repeat(50));
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`⏱️  Time before failure: ${formatDuration(totalTime)}`);
    console.error();
    
    if (error instanceof Error && error.stack && options.verbose) {
      console.error('📋 Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Script interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Script terminated');
  process.exit(0);
});

// Execute the script
main();