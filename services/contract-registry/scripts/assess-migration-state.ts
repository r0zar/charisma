#!/usr/bin/env tsx

/**
 * Migration State Assessment Script
 * 
 * Comprehensive analysis of the current state of token metadata in both:
 * - Token-cache system (@repo/tokens)
 * - Contract-registry system
 * 
 * This script helps plan the migration by identifying:
 * - Current token counts in both systems
 * - Data completeness gaps
 * - Tokens that exist in one system but not the other
 * - Available APIs for bulk operations
 * - Sync mechanism status
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import { listTokens } from '@repo/tokens';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface TokenCacheToken {
  contractId: string;
  name: string;
  symbol: string;
  decimals?: number;
  image?: string;
  description?: string;
  [key: string]: any;
}

interface ContractWithTokenMetadata {
  contractId: string;
  hasTokenMetadata: boolean;
  tokenMetadata?: any;
  contractType: string;
  implementedTraits: string[];
  validationStatus: string;
  discoveryMethod: string;
  lastUpdated: number;
}

interface MigrationAssessment {
  // Token Cache Stats
  tokenCache: {
    totalTokens: number;
    tokensWithMetadata: number;
    tokensWithImages: number;
    sampleTokens: TokenCacheToken[];
  };
  
  // Contract Registry Stats
  contractRegistry: {
    totalContracts: number;
    tokenContracts: number;
    contractsWithTokenMetadata: number;
    sip010Contracts: number;
    sampleContracts: ContractWithTokenMetadata[];
  };
  
  // Comparison & Gaps
  comparison: {
    tokensInBothSystems: string[];
    tokensOnlyInCache: string[];
    tokensOnlyInRegistry: string[];
    completenessGaps: {
      contractId: string;
      missingInCache: boolean;
      missingInRegistry: boolean;
      hasTokenMetadata: boolean;
    }[];
  };
  
  // Migration Planning
  migration: {
    recommendedActions: string[];
    bulkOperationsAvailable: boolean;
    syncMechanismExists: boolean;
    estimatedMigrationComplexity: 'low' | 'medium' | 'high';
    priorityTokens: string[];
  };
}

class MigrationStateAssessor {
  private registry: ContractRegistry;
  
  constructor() {
    const config = createDefaultConfig('mainnet-contract-registry');
    this.registry = new ContractRegistry(config);
  }
  
  async assess(): Promise<MigrationAssessment> {
    console.log('🔍 MIGRATION STATE ASSESSMENT');
    console.log('='.repeat(60));
    
    const assessment: MigrationAssessment = {
      tokenCache: {
        totalTokens: 0,
        tokensWithMetadata: 0,
        tokensWithImages: 0,
        sampleTokens: []
      },
      contractRegistry: {
        totalContracts: 0,
        tokenContracts: 0,
        contractsWithTokenMetadata: 0,
        sip010Contracts: 0,
        sampleContracts: []
      },
      comparison: {
        tokensInBothSystems: [],
        tokensOnlyInCache: [],
        tokensOnlyInRegistry: [],
        completenessGaps: []
      },
      migration: {
        recommendedActions: [],
        bulkOperationsAvailable: true,
        syncMechanismExists: true,
        estimatedMigrationComplexity: 'low',
        priorityTokens: []
      }
    };
    
    // Assess Token Cache System
    console.log('\n📋 Assessing Token Cache System (@repo/tokens)...');
    await this.assessTokenCache(assessment);
    
    // Assess Contract Registry System
    console.log('\n🏗️ Assessing Contract Registry System...');
    await this.assessContractRegistry(assessment);
    
    // Compare Systems
    console.log('\n🔄 Comparing Systems and Identifying Gaps...');
    await this.compareSystemsAndIdentifyGaps(assessment);
    
    // Generate Migration Recommendations
    console.log('\n📝 Generating Migration Recommendations...');
    this.generateMigrationRecommendations(assessment);
    
    return assessment;
  }
  
  private async assessTokenCache(assessment: MigrationAssessment): Promise<void> {
    try {
      const tokens = await listTokens();
      
      assessment.tokenCache.totalTokens = tokens.length;
      assessment.tokenCache.tokensWithMetadata = tokens.filter(t => t.name && t.symbol).length;
      assessment.tokenCache.tokensWithImages = tokens.filter(t => t.image && !t.image.includes('ui-avatars.com')).length;
      
      // Sample first 10 tokens for inspection
      assessment.tokenCache.sampleTokens = tokens.slice(0, 10).map(token => ({
        contractId: token.contractId || 'unknown',
        name: token.name || 'Unknown',
        symbol: token.symbol || 'Unknown',
        decimals: token.decimals,
        image: token.image || undefined,
        description: token.description || undefined
      }));
      
      console.log(`   ✅ Found ${tokens.length} tokens in token cache`);
      console.log(`   📝 ${assessment.tokenCache.tokensWithMetadata} have complete metadata`);
      console.log(`   🖼️  ${assessment.tokenCache.tokensWithImages} have real images`);
      
    } catch (error) {
      console.error(`   ❌ Failed to assess token cache: ${error}`);
      assessment.migration.recommendedActions.push('Fix token cache access issues');
    }
  }
  
  private async assessContractRegistry(assessment: MigrationAssessment): Promise<void> {
    try {
      // Get registry stats
      const stats = await this.registry.getStats();
      assessment.contractRegistry.totalContracts = stats.totalContracts;
      assessment.contractRegistry.tokenContracts = stats.contractsByType.token;
      
      // Get SIP010 contracts
      const sip010Contracts = await this.registry.searchContracts({
        implementedTraits: ['SIP010'],
        limit: 100
      });
      assessment.contractRegistry.sip010Contracts = sip010Contracts.total;
      
      // Check for contracts with token metadata
      let contractsWithTokenMetadata = 0;
      const sampleContracts: ContractWithTokenMetadata[] = [];
      
      if (sip010Contracts.contracts.length > 0) {
        for (const contract of sip010Contracts.contracts.slice(0, 10)) {
          const hasTokenMetadata = !!contract.tokenMetadata;
          if (hasTokenMetadata) contractsWithTokenMetadata++;
          
          sampleContracts.push({
            contractId: contract.contractId,
            hasTokenMetadata,
            tokenMetadata: contract.tokenMetadata,
            contractType: contract.contractType,
            implementedTraits: contract.implementedTraits,
            validationStatus: contract.validationStatus,
            discoveryMethod: contract.discoveryMethod,
            lastUpdated: contract.lastUpdated
          });
        }
      }
      
      assessment.contractRegistry.contractsWithTokenMetadata = contractsWithTokenMetadata;
      assessment.contractRegistry.sampleContracts = sampleContracts;
      
      console.log(`   ✅ Found ${stats.totalContracts} total contracts in registry`);
      console.log(`   🪙 ${stats.contractsByType.token} classified as token contracts`);
      console.log(`   📋 ${sip010Contracts.total} SIP010-compliant contracts`);
      console.log(`   📝 ${contractsWithTokenMetadata} contracts have token metadata populated`);
      
    } catch (error) {
      console.error(`   ❌ Failed to assess contract registry: ${error}`);
      assessment.migration.recommendedActions.push('Fix contract registry access issues');
    }
  }
  
  private async compareSystemsAndIdentifyGaps(assessment: MigrationAssessment): Promise<void> {
    try {
      // Get tokens from cache
      const cacheTokens = await listTokens();
      const cacheContractIds = new Set(cacheTokens.map(t => t.contractId).filter(Boolean));
      
      // Get contracts from registry
      const registryContractIds = new Set(await this.registry.getAllContracts());
      
      // Find intersections and differences
      assessment.comparison.tokensInBothSystems = Array.from(cacheContractIds).filter(id => registryContractIds.has(id));
      assessment.comparison.tokensOnlyInCache = Array.from(cacheContractIds).filter(id => !registryContractIds.has(id));
      assessment.comparison.tokensOnlyInRegistry = Array.from(registryContractIds).filter(id => !cacheContractIds.has(id));
      
      // Sample completeness gaps analysis
      const sampleIds = Array.from(new Set([
        ...assessment.comparison.tokensInBothSystems.slice(0, 5),
        ...assessment.comparison.tokensOnlyInCache.slice(0, 3),
        ...assessment.comparison.tokensOnlyInRegistry.slice(0, 3)
      ]));
      
      for (const contractId of sampleIds) {
        const inCache = cacheContractIds.has(contractId);
        const inRegistry = registryContractIds.has(contractId);
        let hasTokenMetadata = false;
        
        if (inRegistry) {
          try {
            const contract = await this.registry.getContract(contractId);
            hasTokenMetadata = !!contract?.tokenMetadata;
          } catch (error) {
            // Ignore individual contract fetch errors
          }
        }
        
        assessment.comparison.completenessGaps.push({
          contractId,
          missingInCache: !inCache,
          missingInRegistry: !inRegistry,
          hasTokenMetadata
        });
      }
      
      console.log(`   🔄 ${assessment.comparison.tokensInBothSystems.length} tokens exist in both systems`);
      console.log(`   📋 ${assessment.comparison.tokensOnlyInCache.length} tokens only in cache`);
      console.log(`   🏗️  ${assessment.comparison.tokensOnlyInRegistry.length} contracts only in registry`);
      
    } catch (error) {
      console.error(`   ❌ Failed to compare systems: ${error}`);
      assessment.migration.recommendedActions.push('Fix system comparison issues');
    }
  }
  
  private generateMigrationRecommendations(assessment: MigrationAssessment): void {
    const { tokenCache, contractRegistry, comparison } = assessment;
    const actions: string[] = [];
    
    // Assess complexity
    let complexity: 'low' | 'medium' | 'high' = 'low';
    
    if (tokenCache.totalTokens === 0) {
      actions.push('Token cache appears empty - investigate token cache service');
      complexity = 'high';
    }
    
    if (contractRegistry.totalContracts === 0) {
      actions.push('Contract registry appears empty - run initial discovery/population');
      complexity = 'high';
    }
    
    // Migration priorities
    if (comparison.tokensOnlyInCache.length > 0) {
      actions.push(`Migrate ${comparison.tokensOnlyInCache.length} tokens from cache to registry using syncWithTokenCache()`);
      if (comparison.tokensOnlyInCache.length > 50) complexity = 'medium';
    }
    
    if (contractRegistry.contractsWithTokenMetadata < contractRegistry.sip010Contracts) {
      const missing = contractRegistry.sip010Contracts - contractRegistry.contractsWithTokenMetadata;
      actions.push(`Populate token metadata for ${missing} SIP010 contracts in registry`);
      if (missing > 100) complexity = 'medium';
    }
    
    if (tokenCache.tokensWithImages < tokenCache.totalTokens / 2) {
      actions.push('Many tokens in cache lack proper images - consider image migration');
    }
    
    // Determine priority tokens (those with complete metadata in cache)
    const priorityTokens = assessment.tokenCache.sampleTokens
      .filter(t => t.name !== 'Unknown' && t.symbol !== 'Unknown' && t.image)
      .map(t => t.contractId)
      .slice(0, 10);
    
    // Check for existing sync capabilities
    const syncExists = true; // We found syncWithTokenCache method
    const bulkOpsAvailable = true; // ContractRegistry has bulk methods
    
    assessment.migration = {
      recommendedActions: actions,
      bulkOperationsAvailable: bulkOpsAvailable,
      syncMechanismExists: syncExists,
      estimatedMigrationComplexity: complexity,
      priorityTokens
    };
    
    console.log(`   📊 Migration complexity: ${complexity.toUpperCase()}`);
    console.log(`   🔧 Sync mechanism available: ${syncExists ? 'YES' : 'NO'}`);
    console.log(`   ⚡ Bulk operations available: ${bulkOpsAvailable ? 'YES' : 'NO'}`);
  }
  
  printSummary(assessment: MigrationAssessment): void {
    console.log('\n📊 MIGRATION ASSESSMENT SUMMARY');
    console.log('='.repeat(60));
    
    // Current State
    console.log('\n🏃 CURRENT STATE:');
    console.log(`   Token Cache: ${assessment.tokenCache.totalTokens} tokens`);
    console.log(`   Contract Registry: ${assessment.contractRegistry.totalContracts} contracts (${assessment.contractRegistry.tokenContracts} token contracts)`);
    console.log(`   SIP010 Contracts: ${assessment.contractRegistry.sip010Contracts}`);
    console.log(`   Contracts with token metadata: ${assessment.contractRegistry.contractsWithTokenMetadata}`);
    
    // Data Completeness
    console.log('\n📋 DATA COMPLETENESS:');
    console.log(`   Cache tokens with complete metadata: ${assessment.tokenCache.tokensWithMetadata}/${assessment.tokenCache.totalTokens}`);
    console.log(`   Cache tokens with real images: ${assessment.tokenCache.tokensWithImages}/${assessment.tokenCache.totalTokens}`);
    console.log(`   Registry contracts with token metadata: ${assessment.contractRegistry.contractsWithTokenMetadata}/${assessment.contractRegistry.sip010Contracts}`);
    
    // System Overlap
    console.log('\n🔄 SYSTEM OVERLAP:');
    console.log(`   Tokens in both systems: ${assessment.comparison.tokensInBothSystems.length}`);
    console.log(`   Tokens only in cache: ${assessment.comparison.tokensOnlyInCache.length}`);
    console.log(`   Contracts only in registry: ${assessment.comparison.tokensOnlyInRegistry.length}`);
    
    // Migration Plan
    console.log('\n🚀 MIGRATION PLAN:');
    console.log(`   Complexity: ${assessment.migration.estimatedMigrationComplexity.toUpperCase()}`);
    console.log(`   Sync mechanism exists: ${assessment.migration.syncMechanismExists ? '✅' : '❌'}`);
    console.log(`   Bulk operations available: ${assessment.migration.bulkOperationsAvailable ? '✅' : '❌'}`);
    
    console.log('\n📝 RECOMMENDED ACTIONS:');
    assessment.migration.recommendedActions.forEach((action, i) => {
      console.log(`   ${i + 1}. ${action}`);
    });
    
    // Available Methods
    console.log('\n🔧 AVAILABLE MIGRATION METHODS:');
    console.log('   • ContractRegistry.syncWithTokenCache() - Syncs all tokens from cache to registry');
    console.log('   • ContractRegistry.addContract(contractId) - Adds individual contracts with analysis');
    console.log('   • ContractRegistry.updateContract(contractId, updates) - Updates existing contract metadata');
    console.log('   • ContractRegistry.searchContracts(query) - Finds contracts by criteria');
    console.log('   • ContractRegistry.getContracts(contractIds) - Bulk retrieval with parallel processing');
    
    // Sample Data
    if (assessment.tokenCache.sampleTokens.length > 0) {
      console.log('\n📋 SAMPLE TOKEN CACHE DATA:');
      assessment.tokenCache.sampleTokens.slice(0, 5).forEach(token => {
        console.log(`   • ${token.contractId} - ${token.name} (${token.symbol}) ${token.image ? '🖼️' : '❌'}`);
      });
    }
    
    if (assessment.contractRegistry.sampleContracts.length > 0) {
      console.log('\n🏗️ SAMPLE REGISTRY DATA:');
      assessment.contractRegistry.sampleContracts.slice(0, 5).forEach(contract => {
        console.log(`   • ${contract.contractId} - ${contract.contractType} ${contract.hasTokenMetadata ? '📝' : '❌'} [${contract.implementedTraits.join(', ')}]`);
      });
    }
    
    if (assessment.comparison.tokensOnlyInCache.length > 0) {
      console.log('\n🏃 TOKENS ONLY IN CACHE (need migration):');
      assessment.comparison.tokensOnlyInCache.slice(0, 10).forEach(contractId => {
        console.log(`   • ${contractId}`);
      });
      if (assessment.comparison.tokensOnlyInCache.length > 10) {
        console.log(`   ... and ${assessment.comparison.tokensOnlyInCache.length - 10} more`);
      }
    }
  }
}

async function main() {
  try {
    const assessor = new MigrationStateAssessor();
    const assessment = await assessor.assess();
    assessor.printSummary(assessment);
    
    console.log('\n✅ Migration assessment completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Review the recommended actions above');
    console.log('2. Run: tsx sync-token-cache.ts --dry-run to preview sync operation');
    console.log('3. Run: tsx sync-token-cache.ts to execute the migration');
    console.log('4. Monitor the migration progress and verify results');
    
  } catch (error) {
    console.error('❌ Assessment failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the assessment
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});