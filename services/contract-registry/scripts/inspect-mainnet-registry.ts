#!/usr/bin/env tsx

/**
 * Inspect Mainnet Registry Script
 * 
 * Provides comprehensive inspection and statistics for the mainnet contract registry.
 * Shows detailed analytics about contracts, traits, analysis status, and system health.
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import type { ContractMetadata, ContractType, ValidationStatus } from '../src/types';
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

interface InspectionOptions {
  verbose: boolean;
  includeContracts: boolean;
  exportJson: string | undefined;
  showErrors: boolean;
}

interface RegistryInspection {
  overview: {
    totalContracts: number;
    lastUpdated: string;
    systemHealth: 'healthy' | 'warning' | 'critical';
    healthDetails: any;
  };
  contractDistribution: {
    byType: Record<ContractType, number>;
    byStatus: Record<ValidationStatus, number>;
    byTrait: Record<string, number>;
    byDiscoveryMethod: Record<string, number>;
  };
  analysisStatus: {
    fullyAnalyzed: number;
    partiallyAnalyzed: number;
    notAnalyzed: number;
    analysisErrors: number;
    averageAnalysisTime: number;
    lastAnalysisRun: string;
  };
  transferFunctionAnalysis: {
    contractsWithTransfer: number;
    averageTransferSize: number;
    contractsWithExternalCalls: number;
    transferSizeDistribution: Record<string, number>;
  };
  storageStats: {
    blobStorage: any;
    indexStats: any;
    cachePerformance: {
      hitRate: number;
      totalQueries: number;
    };
  };
  timeline: {
    contractsAddedToday: number;
    contractsAddedThisWeek: number;
    contractsAddedThisMonth: number;
    lastDiscoveryRun: string;
  };
  topContracts: {
    largestBySize: Array<{ contractId: string; size: number }>;
    mostRecentlyAdded: Array<{ contractId: string; addedAt: string }>;
    mostComplexTransferFunctions: Array<{ contractId: string; transferSize: number }>;
  };
  potentialIssues: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    contractId?: string;
    details?: any;
  }>;
}

class MainnetRegistryInspector {
  private registry: ContractRegistry;
  private options: InspectionOptions;

  constructor(options: InspectionOptions) {
    this.options = options;
    
    // Initialize registry with read-only operations
    const config = createDefaultConfig('mainnet-contract-registry');
    this.registry = new ContractRegistry(config);
  }

  /**
   * Perform comprehensive registry inspection
   */
  async inspect(): Promise<RegistryInspection> {
    console.log('🔍 Inspecting mainnet contract registry...\n');

    const inspection: RegistryInspection = {
      overview: await this.generateOverview(),
      contractDistribution: await this.analyzeContractDistribution(),
      analysisStatus: await this.analyzeAnalysisStatus(),
      transferFunctionAnalysis: await this.analyzeTransferFunctions(),
      storageStats: await this.analyzeStorageStats(),
      timeline: await this.analyzeTimeline(),
      topContracts: await this.findTopContracts(),
      potentialIssues: []
    };

    // Identify potential issues
    inspection.potentialIssues = this.identifyIssues(inspection);

    return inspection;
  }

  /**
   * Generate system overview
   */
  private async generateOverview(): Promise<RegistryInspection['overview']> {
    console.log('📊 Generating system overview...');
    
    try {
      // Try to get basic stats with short timeout
      console.log('   Fetching registry stats (with 5s timeout)...');
      const stats = await withTimeout(this.registry.getStats(), 5000);
      console.log('   ✅ Stats retrieved successfully');
      
      console.log('   Checking registry health (with 5s timeout)...');
      const health = await withTimeout(this.registry.getHealth(), 5000);
      console.log('   ✅ Health check completed');
      
      let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (!health.healthy) {
        systemHealth = health.issues && health.issues.length > 2 ? 'critical' : 'warning';
      }

      return {
        totalContracts: stats.totalContracts,
        lastUpdated: new Date().toISOString(),
        systemHealth,
        healthDetails: health
      };
    } catch (error) {
      console.error('❌ Failed to generate overview:', error);
      console.log('   Falling back to basic storage layer checks...');
      
      // Fallback: try to get basic info from storage layer directly
      try {
        // Create a separate IndexManager instance for fallback
        const { IndexManager } = await import('../src/storage/IndexManager');
        const fallbackIndexManager = new IndexManager({
          serviceName: 'mainnet-contract-registry',
          keyPrefix: 'mainnet-contract-registry:'
        });
        const indexStats = await withTimeout(fallbackIndexManager.getStats(), 3000);
        console.log('   ✅ Retrieved index stats as fallback');
        
        return {
          totalContracts: 0,
          lastUpdated: new Date().toISOString(),
          systemHealth: 'warning',
          healthDetails: { 
            error: `Registry getStats() failed: ${error}`,
            fallbackMode: true,
            indexStats 
          }
        };
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        return {
          totalContracts: 0,
          lastUpdated: new Date().toISOString(),
          systemHealth: 'critical',
          healthDetails: { 
            error: `Both registry and fallback failed: ${error}`,
            fallbackError: String(fallbackError)
          }
        };
      }
    }
  }

  /**
   * Analyze contract distribution across various dimensions
   */
  private async analyzeContractDistribution(): Promise<RegistryInspection['contractDistribution']> {
    console.log('📈 Analyzing contract distribution...');
    
    try {
      console.log('   Fetching contract statistics...');
      const stats = await withTimeout(this.registry.getStats(), 15000);
      
      // Get trait distribution
      console.log('   Loading all contracts...');
      const allContracts = await withTimeout(this.registry.getAllContracts(), 20000);
      const byTrait: Record<string, number> = {};
      const byDiscoveryMethod: Record<string, number> = {};

      // Sample analysis on subset for performance - use much smaller sample
      const sampleSize = Math.min(20, allContracts.length);
      const sampleContracts = allContracts.slice(0, sampleSize);
      
      // Process contracts in parallel with timeouts
      const contractPromises = sampleContracts.map(async (contractId) => {
        try {
          // Add timeout for individual contract fetch
          const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Contract fetch timeout')), 3000)
          );
          
          const metadata = await Promise.race([
            this.registry.getContract(contractId),
            timeoutPromise
          ]);
          
          if (metadata) {
            const traits: string[] = [];
            metadata.implementedTraits.forEach(trait => {
              traits.push(trait);
            });
            
            return {
              traits,
              discoveryMethod: metadata.discoveryMethod || 'unknown'
            };
          }
          return null;
        } catch (error) {
          return null;
        }
      });
      
      const results = await Promise.all(contractPromises);
      
      // Count traits and discovery methods from results
      for (const result of results) {
        if (result) {
          result.traits.forEach(trait => {
            byTrait[trait] = (byTrait[trait] || 0) + 1;
          });
          
          byDiscoveryMethod[result.discoveryMethod] = (byDiscoveryMethod[result.discoveryMethod] || 0) + 1;
        }
      }

      // Extrapolate from sample
      if (sampleSize < allContracts.length) {
        const multiplier = allContracts.length / sampleSize;
        Object.keys(byTrait).forEach(trait => {
          byTrait[trait] = Math.round(byTrait[trait] * multiplier);
        });
        Object.keys(byDiscoveryMethod).forEach(method => {
          byDiscoveryMethod[method] = Math.round(byDiscoveryMethod[method] * multiplier);
        });
      }

      return {
        byType: stats.contractsByType,
        byStatus: stats.contractsByStatus,
        byTrait,
        byDiscoveryMethod
      };
    } catch (error) {
      console.error('❌ Failed to analyze distribution:', error);
      return {
        byType: { token: 0, nft: 0, vault: 0, unknown: 0 },
        byStatus: { valid: 0, invalid: 0, blocked: 0, pending: 0 },
        byTrait: {},
        byDiscoveryMethod: {}
      };
    }
  }

  /**
   * Analyze analysis status and completeness
   */
  private async analyzeAnalysisStatus(): Promise<RegistryInspection['analysisStatus']> {
    console.log('🔬 Analyzing analysis status...');
    
    try {
      const stats = await this.registry.getStats();
      const allContracts = await this.registry.getAllContracts();
      
      let fullyAnalyzed = 0;
      let partiallyAnalyzed = 0;
      let notAnalyzed = 0;
      let analysisErrors = 0;

      // Sample analysis for performance - use smaller sample with parallel processing
      const sampleSize = Math.min(15, allContracts.length);
      const sampleContracts = allContracts.slice(0, sampleSize);
      
      // Process contracts in parallel with timeouts
      const analysisPromises = sampleContracts.map(async (contractId) => {
        try {
          // Add timeout for individual contract fetch
          const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Contract fetch timeout')), 2000)
          );
          
          const metadata = await Promise.race([
            this.registry.getContract(contractId),
            timeoutPromise
          ]);
          
          if (metadata) {
            const hasSourceCode = metadata.sourceCode && metadata.sourceCode.length > 0;
            const hasAbi = metadata.abi && metadata.abi.length > 0;
            const hasAnalysis = metadata.lastAnalyzed && metadata.lastAnalyzed > 0;
            
            return {
              status: hasSourceCode && hasAbi && hasAnalysis ? 'fully' :
                     (hasAnalysis || hasSourceCode || hasAbi) ? 'partial' : 'none',
              error: false
            };
          }
          return { status: 'none', error: false };
        } catch (error) {
          return { status: 'none', error: true };
        }
      });
      
      const analysisResults = await Promise.all(analysisPromises);
      
      // Count results
      for (const result of analysisResults) {
        if (result.error) {
          analysisErrors++;
        } else {
          switch (result.status) {
            case 'fully':
              fullyAnalyzed++;
              break;
            case 'partial':
              partiallyAnalyzed++;
              break;
            case 'none':
              notAnalyzed++;
              break;
          }
        }
      }

      // Extrapolate from sample
      if (sampleSize < allContracts.length) {
        const multiplier = allContracts.length / sampleSize;
        fullyAnalyzed = Math.round(fullyAnalyzed * multiplier);
        partiallyAnalyzed = Math.round(partiallyAnalyzed * multiplier);
        notAnalyzed = Math.round(notAnalyzed * multiplier);
        analysisErrors = Math.round(analysisErrors * multiplier);
      }

      return {
        fullyAnalyzed,
        partiallyAnalyzed,
        notAnalyzed,
        analysisErrors,
        averageAnalysisTime: stats.averageAnalysisTime,
        lastAnalysisRun: new Date(stats.lastAnalysis || 0).toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to analyze analysis status:', error);
      return {
        fullyAnalyzed: 0,
        partiallyAnalyzed: 0,
        notAnalyzed: 0,
        analysisErrors: 0,
        averageAnalysisTime: 0,
        lastAnalysisRun: 'unknown'
      };
    }
  }

  /**
   * Analyze transfer function patterns
   */
  private async analyzeTransferFunctions(): Promise<RegistryInspection['transferFunctionAnalysis']> {
    console.log('🔄 Analyzing transfer function patterns...');
    
    try {
      const allContracts = await this.registry.getAllContracts();
      
      let contractsWithTransfer = 0;
      let totalTransferSize = 0;
      let contractsWithExternalCalls = 0;
      const transferSizeDistribution: Record<string, number> = {
        'small (0-100)': 0,
        'medium (101-500)': 0,
        'large (501-1000)': 0,
        'xlarge (1000+)': 0
      };

      // Sample analysis for performance - use smaller sample with parallel processing
      const sampleSize = Math.min(10, allContracts.length);
      const sampleContracts = allContracts.slice(0, sampleSize);
      
      // Process contracts in parallel with timeouts
      const transferPromises = sampleContracts.map(async (contractId) => {
        try {
          // Add timeout for individual contract fetch
          const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Contract fetch timeout')), 2000)
          );
          
          const metadata = await Promise.race([
            this.registry.getContract(contractId),
            timeoutPromise
          ]);
          
          if (metadata?.sourceMetadata) {
            const transferSize = metadata.sourceMetadata.transferFunctionSize || 0;
            const hasExternalCalls = metadata.sourceMetadata.transferHasExternalCalls || false;
            
            return {
              transferSize,
              hasExternalCalls,
              hasTransfer: transferSize > 0
            };
          }
          return null;
        } catch (error) {
          return null;
        }
      });
      
      const transferResults = await Promise.all(transferPromises);
      
      // Process results
      for (const result of transferResults) {
        if (result && result.hasTransfer) {
          contractsWithTransfer++;
          totalTransferSize += result.transferSize;
          
          if (result.hasExternalCalls) {
            contractsWithExternalCalls++;
          }
          
          // Categorize by size
          if (result.transferSize <= 100) {
            transferSizeDistribution['small (0-100)']++;
          } else if (result.transferSize <= 500) {
            transferSizeDistribution['medium (101-500)']++;
          } else if (result.transferSize <= 1000) {
            transferSizeDistribution['large (501-1000)']++;
          } else {
            transferSizeDistribution['xlarge (1000+)']++;
          }
        }
      }

      // Extrapolate from sample
      const multiplier = allContracts.length / sampleSize;
      if (sampleSize < allContracts.length) {
        contractsWithTransfer = Math.round(contractsWithTransfer * multiplier);
        contractsWithExternalCalls = Math.round(contractsWithExternalCalls * multiplier);
        Object.keys(transferSizeDistribution).forEach(key => {
          transferSizeDistribution[key] = Math.round(transferSizeDistribution[key] * multiplier);
        });
      }

      return {
        contractsWithTransfer,
        averageTransferSize: contractsWithTransfer > 0 ? Math.round(totalTransferSize / contractsWithTransfer) : 0,
        contractsWithExternalCalls,
        transferSizeDistribution
      };
    } catch (error) {
      console.error('❌ Failed to analyze transfer functions:', error);
      return {
        contractsWithTransfer: 0,
        averageTransferSize: 0,
        contractsWithExternalCalls: 0,
        transferSizeDistribution: {}
      };
    }
  }

  /**
   * Analyze storage statistics and performance
   */
  private async analyzeStorageStats(): Promise<RegistryInspection['storageStats']> {
    console.log('💾 Analyzing storage statistics...');
    
    try {
      const stats = await this.registry.getStats();
      
      // Try to get more detailed storage stats (these methods may not exist)
      let blobStorage = {};
      let indexStats = {};
      
      try {
        // Access internal storage if possible (this is implementation dependent)
        blobStorage = { summary: 'Storage stats not directly accessible' };
        indexStats = { summary: 'Index stats not directly accessible' };
      } catch (error) {
        // Expected if internal access is not available
      }

      return {
        blobStorage,
        indexStats,
        cachePerformance: {
          hitRate: stats.cacheHitRate,
          totalQueries: 0 // Not directly available
        }
      };
    } catch (error) {
      console.error('❌ Failed to analyze storage stats:', error);
      return {
        blobStorage: {},
        indexStats: {},
        cachePerformance: { hitRate: 0, totalQueries: 0 }
      };
    }
  }

  /**
   * Analyze timeline and recent activity
   */
  private async analyzeTimeline(): Promise<RegistryInspection['timeline']> {
    console.log('📅 Analyzing timeline and activity...');
    
    try {
      const stats = await this.registry.getStats();
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);
      
      // These would require timestamp analysis on actual contracts
      // For now, provide estimates based on available data
      
      return {
        contractsAddedToday: 0, // Would need contract timestamp analysis
        contractsAddedThisWeek: 0, // Would need contract timestamp analysis
        contractsAddedThisMonth: 0, // Would need contract timestamp analysis
        lastDiscoveryRun: new Date(stats.lastDiscovery || 0).toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to analyze timeline:', error);
      return {
        contractsAddedToday: 0,
        contractsAddedThisWeek: 0,
        contractsAddedThisMonth: 0,
        lastDiscoveryRun: 'unknown'
      };
    }
  }

  /**
   * Find top contracts by various metrics
   */
  private async findTopContracts(): Promise<RegistryInspection['topContracts']> {
    console.log('🏆 Finding top contracts...');
    
    try {
      const allContracts = await this.registry.getAllContracts();
      
      const contractMetrics: Array<{
        contractId: string;
        size: number;
        addedAt: number;
        transferSize: number;
      }> = [];

      // Sample for performance
      const sampleSize = Math.min(20, allContracts.length);
      const sampleContracts = allContracts.slice(0, sampleSize);
      
      for (const contractId of sampleContracts) {
        try {
          const metadata = await this.registry.getContract(contractId);
          if (metadata) {
            contractMetrics.push({
              contractId,
              size: metadata.sourceCode?.length || 0,
              addedAt: metadata.discoveredAt || 0,
              transferSize: metadata.sourceMetadata?.transferFunctionSize || 0
            });
          }
        } catch (error) {
          // Skip problematic contracts
        }
      }

      // Sort and get top contracts
      const largestBySize = contractMetrics
        .sort((a, b) => b.size - a.size)
        .slice(0, 5)
        .map(c => ({ contractId: c.contractId, size: c.size }));

      const mostRecentlyAdded = contractMetrics
        .sort((a, b) => b.addedAt - a.addedAt)
        .slice(0, 5)
        .map(c => ({ contractId: c.contractId, addedAt: new Date(c.addedAt).toISOString() }));

      const mostComplexTransferFunctions = contractMetrics
        .filter(c => c.transferSize > 0)
        .sort((a, b) => b.transferSize - a.transferSize)
        .slice(0, 5)
        .map(c => ({ contractId: c.contractId, transferSize: c.transferSize }));

      return {
        largestBySize,
        mostRecentlyAdded,
        mostComplexTransferFunctions
      };
    } catch (error) {
      console.error('❌ Failed to find top contracts:', error);
      return {
        largestBySize: [],
        mostRecentlyAdded: [],
        mostComplexTransferFunctions: []
      };
    }
  }

  /**
   * Identify potential issues with the registry
   */
  private identifyIssues(inspection: RegistryInspection): RegistryInspection['potentialIssues'] {
    const issues: RegistryInspection['potentialIssues'] = [];

    // Check system health
    if (inspection.overview.systemHealth !== 'healthy') {
      issues.push({
        type: inspection.overview.systemHealth === 'critical' ? 'error' : 'warning',
        message: 'System health check failed',
        details: inspection.overview.healthDetails
      });
    }

    // Check analysis completeness
    const totalContracts = inspection.overview.totalContracts;
    const analysisRate = totalContracts > 0 
      ? inspection.analysisStatus.fullyAnalyzed / totalContracts 
      : 0;
    
    if (analysisRate < 0.8) {
      issues.push({
        type: 'warning',
        message: `Low analysis completion rate: ${Math.round(analysisRate * 100)}%`,
        details: { 
          fullyAnalyzed: inspection.analysisStatus.fullyAnalyzed,
          totalContracts
        }
      });
    }

    // Check for analysis errors
    if (inspection.analysisStatus.analysisErrors > 0) {
      issues.push({
        type: 'warning',
        message: `Analysis errors detected: ${inspection.analysisStatus.analysisErrors} contracts`,
        details: inspection.analysisStatus
      });
    }

    // Check cache performance
    if (inspection.storageStats.cachePerformance.hitRate < 0.7) {
      issues.push({
        type: 'info',
        message: `Low cache hit rate: ${Math.round(inspection.storageStats.cachePerformance.hitRate * 100)}%`,
        details: inspection.storageStats.cachePerformance
      });
    }

    return issues;
  }

  /**
   * Display inspection results
   */
  displayResults(inspection: RegistryInspection): void {
    console.log('\n📊 MAINNET REGISTRY INSPECTION RESULTS');
    console.log('='.repeat(60));

    // Overview
    console.log(`\n🏗️  SYSTEM OVERVIEW:`);
    console.log(`   Total contracts: ${inspection.overview.totalContracts.toLocaleString()}`);
    console.log(`   System health: ${this.getHealthIcon(inspection.overview.systemHealth)} ${inspection.overview.systemHealth.toUpperCase()}`);
    console.log(`   Last updated: ${new Date(inspection.overview.lastUpdated).toLocaleString()}`);

    // Contract distribution
    console.log(`\n📈 CONTRACT DISTRIBUTION:`);
    console.log(`   By type:`);
    Object.entries(inspection.contractDistribution.byType).forEach(([type, count]) => {
      console.log(`     ${type}: ${count.toLocaleString()}`);
    });
    console.log(`   By status:`);
    Object.entries(inspection.contractDistribution.byStatus).forEach(([status, count]) => {
      console.log(`     ${status}: ${count.toLocaleString()}`);
    });

    // Top traits
    const topTraits = Object.entries(inspection.contractDistribution.byTrait)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    if (topTraits.length > 0) {
      console.log(`   Top traits:`);
      topTraits.forEach(([trait, count]) => {
        console.log(`     ${trait}: ${count.toLocaleString()}`);
      });
    }

    // Analysis status
    console.log(`\n🔬 ANALYSIS STATUS:`);
    console.log(`   Fully analyzed: ${inspection.analysisStatus.fullyAnalyzed.toLocaleString()}`);
    console.log(`   Partially analyzed: ${inspection.analysisStatus.partiallyAnalyzed.toLocaleString()}`);
    console.log(`   Not analyzed: ${inspection.analysisStatus.notAnalyzed.toLocaleString()}`);
    console.log(`   Analysis errors: ${inspection.analysisStatus.analysisErrors.toLocaleString()}`);
    console.log(`   Average analysis time: ${inspection.analysisStatus.averageAnalysisTime}ms`);

    // Transfer function analysis
    console.log(`\n🔄 TRANSFER FUNCTION ANALYSIS:`);
    console.log(`   Contracts with transfer function: ${inspection.transferFunctionAnalysis.contractsWithTransfer.toLocaleString()}`);
    console.log(`   Average transfer function size: ${inspection.transferFunctionAnalysis.averageTransferSize} characters`);
    console.log(`   Contracts with external calls: ${inspection.transferFunctionAnalysis.contractsWithExternalCalls.toLocaleString()}`);
    
    // Size distribution
    if (Object.keys(inspection.transferFunctionAnalysis.transferSizeDistribution).length > 0) {
      console.log(`   Size distribution:`);
      Object.entries(inspection.transferFunctionAnalysis.transferSizeDistribution).forEach(([range, count]) => {
        console.log(`     ${range}: ${count.toLocaleString()}`);
      });
    }

    // Top contracts
    console.log(`\n🏆 TOP CONTRACTS:`);
    if (inspection.topContracts.largestBySize.length > 0) {
      console.log(`   Largest by source code:`);
      inspection.topContracts.largestBySize.forEach(contract => {
        console.log(`     ${contract.contractId}: ${contract.size.toLocaleString()} chars`);
      });
    }

    if (inspection.topContracts.mostComplexTransferFunctions.length > 0) {
      console.log(`   Most complex transfer functions:`);
      inspection.topContracts.mostComplexTransferFunctions.forEach(contract => {
        console.log(`     ${contract.contractId}: ${contract.transferSize} chars`);
      });
    }

    // Issues
    if (inspection.potentialIssues.length > 0) {
      console.log(`\n⚠️  POTENTIAL ISSUES (${inspection.potentialIssues.length}):`);
      inspection.potentialIssues.forEach(issue => {
        const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`   ${icon} ${issue.message}`);
        if (this.options.verbose && issue.details) {
          console.log(`      Details: ${JSON.stringify(issue.details, null, 6)}`);
        }
      });
    } else {
      console.log(`\n✅ NO ISSUES DETECTED`);
    }

    // Recommendations
    console.log(`\n💡 RECOMMENDATIONS:`);
    this.generateRecommendations(inspection).forEach(rec => {
      console.log(`   • ${rec}`);
    });
  }

  /**
   * Generate recommendations based on inspection results
   */
  private generateRecommendations(inspection: RegistryInspection): string[] {
    const recommendations: string[] = [];
    
    const analysisRate = inspection.overview.totalContracts > 0 
      ? inspection.analysisStatus.fullyAnalyzed / inspection.overview.totalContracts 
      : 0;

    if (analysisRate < 0.9) {
      recommendations.push('Run npm run script:refresh-analysis to complete missing analysis');
    }

    if (inspection.analysisStatus.analysisErrors > 0) {
      recommendations.push('Investigate and fix analysis errors with npm run script:audit-data');
    }

    if (inspection.overview.systemHealth !== 'healthy') {
      recommendations.push('Check system health issues and resolve component problems');
    }

    if (inspection.contractDistribution.byStatus.pending > 0) {
      recommendations.push('Review and validate pending contracts');
    }

    if (recommendations.length === 0) {
      recommendations.push('Registry appears to be in good condition');
      recommendations.push('Consider running regular audits with npm run script:audit-data');
    }

    return recommendations;
  }

  /**
   * Get health status icon
   */
  private getHealthIcon(health: string): string {
    switch (health) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '❌';
      default: return '❓';
    }
  }

  /**
   * Export results to JSON file
   */
  async exportToJson(inspection: RegistryInspection, filepath: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(filepath, JSON.stringify(inspection, null, 2));
    console.log(`\n📄 Results exported to: ${filepath}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: InspectionOptions = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    includeContracts: args.includes('--include-contracts') || args.includes('-c'),
    exportJson: args.find(arg => arg.startsWith('--export-json='))?.split('=')[1],
    showErrors: args.includes('--show-errors')
  };

  console.log('🔍 MAINNET CONTRACT REGISTRY INSPECTION');
  console.log('='.repeat(50));
  console.log(`Verbose mode: ${options.verbose ? 'ON' : 'OFF'}`);
  console.log(`Include contracts: ${options.includeContracts ? 'ON' : 'OFF'}`);
  if (options.exportJson) {
    console.log(`Export to: ${options.exportJson}`);
  }
  console.log();

  try {
    console.log('🔄 Initializing registry inspector...');
    const inspector = new MainnetRegistryInspector(options);
    
    console.log('📊 Analyzing registry data...');
    const inspectionResult = await inspector.inspect();
    
    if (options.exportJson) {
      console.log('💾 Exporting results to JSON...');
      await inspector.exportToJson(inspectionResult, options.exportJson);
    }
    
    inspector.displayResults(inspectionResult);
    
    console.log('\n🎉 Inspection completed successfully!');
    if (options.exportJson) {
      console.log(`📄 Results exported to: ${options.exportJson}`);
    }
  } catch (err) {
    console.error('\n💥 Inspection failed:', err instanceof Error ? err.message : String(err));
    console.log('Please check the error message above and try again.');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Script interrupted by user');
  process.exit(0);
});

// Execute the script
main();