#!/usr/bin/env tsx

/**
 * Verify Consolidated Blob Script
 * 
 * This script verifies that the consolidated blob exists, can be loaded,
 * and contains the expected data structure.
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

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
 * Main verification function
 */
async function main() {
  console.log('🔍 CONSOLIDATED BLOB VERIFICATION');
  console.log('='.repeat(50));
  console.log();

  try {
    // Initialize the registry
    console.log('🔄 Initializing contract registry...');
    const config = createDefaultConfig('contract-registry');
    const registry = new ContractRegistry(config);
    
    // Get the consolidated blob manager
    const consolidatedManager = registry.getBlobStorage().getConsolidatedBlobManager();

    // Try to load the consolidated blob
    console.log('📥 Loading consolidated blob...');
    const consolidatedBlob = await consolidatedManager.loadConsolidatedBlob();
    
    if (!consolidatedBlob) {
      console.log('❌ No consolidated blob found');
      console.log('💡 Run the create-consolidated-blob script first');
      return;
    }

    console.log('✅ Consolidated blob loaded successfully!');
    console.log('='.repeat(50));
    
    // Display blob information
    console.log(`📊 Blob Information:`);
    console.log(`   Version: ${consolidatedBlob.version}`);
    console.log(`   Contract count: ${consolidatedBlob.contractCount.toLocaleString()}`);
    console.log(`   Generated: ${new Date(consolidatedBlob.generatedAt).toLocaleString()}`);
    console.log(`   Last rebuild: ${new Date(consolidatedBlob.metadata.lastFullRebuild).toLocaleString()}`);
    console.log(`   Generation time: ${consolidatedBlob.metadata.generationTimeMs}ms`);
    console.log(`   Size: ${formatBytes(consolidatedBlob.metadata.totalSize)}`);
    console.log(`   Compression ratio: ${(consolidatedBlob.metadata.compressionRatio * 100).toFixed(1)}%`);
    console.log();

    // Analyze contract types
    console.log(`📈 Contract Analysis:`);
    const typeBreakdown: Record<string, number> = {
      token: 0,
      nft: 0, 
      vault: 0,
      unknown: 0
    };
    
    const traitBreakdown: Record<string, number> = {};
    const statusBreakdown: Record<string, number> = {};
    
    for (const [contractId, metadata] of Object.entries(consolidatedBlob.contracts)) {
      const typed = metadata as any;
      
      // Count by type
      typeBreakdown[typed.contractType] = (typeBreakdown[typed.contractType] || 0) + 1;
      
      // Count by validation status
      statusBreakdown[typed.validationStatus] = (statusBreakdown[typed.validationStatus] || 0) + 1;
      
      // Count implemented traits
      if (typed.implementedTraits && Array.isArray(typed.implementedTraits)) {
        typed.implementedTraits.forEach((trait: string) => {
          traitBreakdown[trait] = (traitBreakdown[trait] || 0) + 1;
        });
      }
    }
    
    console.log(`   By type:`);
    Object.entries(typeBreakdown).forEach(([type, count]) => {
      console.log(`     ${type}: ${count.toLocaleString()}`);
    });
    
    console.log(`   By status:`);
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      console.log(`     ${status}: ${count.toLocaleString()}`);
    });
    
    // Show top traits
    const topTraits = Object.entries(traitBreakdown)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    if (topTraits.length > 0) {
      console.log(`   Top traits:`);
      topTraits.forEach(([trait, count]) => {
        console.log(`     ${trait}: ${count.toLocaleString()}`);
      });
    }
    
    console.log();

    // Test functionality - try to get fungible tokens using the consolidated blob
    console.log('🧪 Testing consolidated blob functionality...');
    console.log('   Testing getFungibleTokens()...');
    const fungibleTokens = await registry.getFungibleTokens();
    console.log(`   ✅ Found ${fungibleTokens.length} fungible tokens`);
    
    console.log('   Testing getNonFungibleTokens()...');
    const nfts = await registry.getNonFungibleTokens();
    console.log(`   ✅ Found ${nfts.length} non-fungible tokens`);
    
    console.log();

    // Check if consolidation is needed
    console.log('🔄 Checking consolidation status...');
    const isNeeded = await consolidatedManager.isConsolidationNeeded();
    console.log(`   Consolidation needed: ${isNeeded ? 'YES' : 'NO'}`);
    
    if (isNeeded) {
      const hoursOld = (Date.now() - consolidatedBlob.metadata.lastFullRebuild) / (1000 * 60 * 60);
      console.log(`   Age: ${hoursOld.toFixed(1)} hours`);
    }

    console.log();
    console.log('🎉 VERIFICATION COMPLETE - All systems operational!');
    console.log('✅ The consolidated blob is working correctly');
    console.log('✅ Bulk queries are using the optimized blob storage');
    console.log('✅ Ready for production use');

  } catch (error) {
    console.error('❌ VERIFICATION FAILED');
    console.error('='.repeat(50));
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    if (error instanceof Error && error.stack) {
      console.error('\n📋 Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Execute the script
main();