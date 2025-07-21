#!/usr/bin/env tsx

/**
 * Refresh Contract Analysis Script
 * 
 * Refreshes analysis for contracts in the mainnet registry that need re-analysis.
 * Handles stale analysis, failed analysis, and contracts with missing data.
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import type { ContractMetadata } from '../src/types';
import { isValidContractId } from '../src/utils/validators';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface RefreshOptions {
  dryRun: boolean;
  verbose: boolean;
  forceAll: boolean;
  batchSize: number;
  maxContracts: number;
  maxAge: number; // Max age in days for considering analysis stale
  prioritizeErrors: boolean;
  onlyMissingData: boolean;
}

interface RefreshCandidate {
  contractId: string;
  reason: 'never_analyzed' | 'stale_analysis' | 'missing_source' | 'missing_abi' | 'analysis_error' | 'forced';
  priority: 'high' | 'medium' | 'low';
  lastAnalyzed: number;
  missingFields: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
}

interface RefreshResult {
  overview: {
    totalCandidates: number;
    selectedForRefresh: number;
    successfulRefresh: number;
    failedRefresh: number;
    skippedRefresh: number;
    startTime: string;
    endTime: string;
    duration: number;
  };
  candidates: RefreshCandidate[];
  results: Array<{
    contractId: string;
    success: boolean;
    previousState: 'never_analyzed' | 'partial' | 'complete' | 'error';
    newState: 'complete' | 'partial' | 'error';
    improvementScore: number; // 0-100
    analysisTime: number;
    error?: string;
    fieldsUpdated: string[];
  }>;
  summary: {
    improvementsByReason: Record<string, number>;
    averageAnalysisTime: number;
    totalDataImprovement: number;
    recommendedFollowUp: string[];
  };
}

class ContractAnalysisRefresher {
  private registry: ContractRegistry;
  private options: RefreshOptions;
  private startTime: number = 0;

  constructor(options: RefreshOptions) {
    this.options = options;
    
    // Initialize registry with full analysis capabilities
    const config = createDefaultConfig('mainnet-contract-registry');
    config.enableAnalysis = true;
    config.analysisTimeout = 60000; // Extended timeout for complex contracts
    
    this.registry = new ContractRegistry(config);
  }

  /**
   * Find and refresh contracts that need analysis updates
   */
  async refresh(): Promise<RefreshResult> {
    this.startTime = Date.now();
    console.log('🔄 Starting contract analysis refresh...\n');

    const result: RefreshResult = {
      overview: {
        totalCandidates: 0,
        selectedForRefresh: 0,
        successfulRefresh: 0,
        failedRefresh: 0,
        skippedRefresh: 0,
        startTime: new Date(this.startTime).toISOString(),
        endTime: '',
        duration: 0
      },
      candidates: [],
      results: [],
      summary: {
        improvementsByReason: {},
        averageAnalysisTime: 0,
        totalDataImprovement: 0,
        recommendedFollowUp: []
      }
    };

    try {
      // Step 1: Identify candidates for refresh
      console.log('🔍 Identifying refresh candidates...');
      result.candidates = await this.identifyRefreshCandidates();
      result.overview.totalCandidates = result.candidates.length;

      if (result.candidates.length === 0) {
        console.log('✅ No contracts need analysis refresh');
        return this.finalizeResult(result);
      }

      // Step 2: Prioritize and select contracts for refresh
      const selectedCandidates = this.selectCandidatesForRefresh(result.candidates);
      result.overview.selectedForRefresh = selectedCandidates.length;

      console.log(`📋 Selected ${selectedCandidates.length} contracts for refresh`);

      if (this.options.dryRun) {
        console.log('\n🔍 DRY RUN - Would refresh:');
        selectedCandidates.forEach(candidate => {
          console.log(`   ${candidate.contractId} (${candidate.reason}, ${candidate.priority} priority)`);
        });
        return this.finalizeResult(result);
      }

      // Step 3: Perform refresh in batches
      await this.refreshContractsBatch(selectedCandidates, result);

      // Step 4: Generate summary and recommendations
      this.generateSummary(result);

    } catch (error) {
      console.error('❌ Refresh failed:', error);
      result.results.push({
        contractId: 'system-error',
        success: false,
        previousState: 'error',
        newState: 'error',
        improvementScore: 0,
        analysisTime: 0,
        error: String(error),
        fieldsUpdated: []
      });
    }

    return this.finalizeResult(result);
  }

  /**
   * Identify contracts that are candidates for refresh
   */
  private async identifyRefreshCandidates(): Promise<RefreshCandidate[]> {
    const candidates: RefreshCandidate[] = [];
    const now = Date.now();
    const staleThreshold = now - (this.options.maxAge * 24 * 60 * 60 * 1000);

    try {
      const allContracts = await this.registry.getAllContracts();
      console.log(`   Evaluating ${allContracts.length} contracts...`);

      // Sample contracts for large registries
      const contractsToEvaluate = allContracts.slice(0, Math.min(this.options.maxContracts, allContracts.length));

      for (const contractId of contractsToEvaluate) {
        try {
          if (!isValidContractId(contractId)) {
            continue; // Skip invalid contract IDs
          }

          const metadata = await this.registry.getContract(contractId);
          if (!metadata) {
            candidates.push({
              contractId,
              reason: 'analysis_error',
              priority: 'high',
              lastAnalyzed: 0,
              missingFields: ['metadata'],
              estimatedEffort: 'medium'
            });
            continue;
          }

          const candidate = this.evaluateContractForRefresh(metadata, staleThreshold);
          if (candidate) {
            candidates.push(candidate);
          }

        } catch (error) {
          candidates.push({
            contractId,
            reason: 'analysis_error',
            priority: 'high',
            lastAnalyzed: 0,
            missingFields: ['access_error'],
            estimatedEffort: 'high'
          });
        }
      }

    } catch (error) {
      console.error('❌ Failed to identify candidates:', error);
    }

    // Sort by priority and then by staleness
    candidates.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return a.lastAnalyzed - b.lastAnalyzed; // Older contracts first
    });

    console.log(`   Found ${candidates.length} refresh candidates`);
    return candidates;
  }

  /**
   * Evaluate a single contract for refresh needs
   */
  private evaluateContractForRefresh(metadata: ContractMetadata, staleThreshold: number): RefreshCandidate | null {
    const missingFields: string[] = [];
    let reason: RefreshCandidate['reason'] = 'forced';
    let priority: RefreshCandidate['priority'] = 'low';
    let estimatedEffort: RefreshCandidate['estimatedEffort'] = 'low';

    // Check if analysis was never performed
    if (!metadata.lastAnalyzed || metadata.lastAnalyzed === 0) {
      reason = 'never_analyzed';
      priority = 'high';
      estimatedEffort = 'medium';
      missingFields.push('analysis_timestamp');
    } 
    // Check if analysis is stale
    else if (metadata.lastAnalyzed < staleThreshold) {
      reason = 'stale_analysis';
      priority = 'medium';
      estimatedEffort = 'low';
    }

    // Check for missing source code
    if (!metadata.sourceCode || metadata.sourceCode.length === 0) {
      missingFields.push('sourceCode');
      if (reason === 'forced') {
        reason = 'missing_source';
        priority = 'high';
        estimatedEffort = 'high';
      }
    }

    // Check for missing ABI
    if (!metadata.abi || metadata.abi.length === 0) {
      missingFields.push('abi');
      if (reason === 'forced') {
        reason = 'missing_abi';
        priority = 'medium';
        estimatedEffort = 'medium';
      }
    }

    // Check for missing source metadata
    if (!metadata.sourceMetadata) {
      missingFields.push('sourceMetadata');
      if (reason === 'forced') {
        reason = 'analysis_error';
        priority = 'medium';
        estimatedEffort = 'medium';
      }
    }

    // Apply option filters
    if (this.options.onlyMissingData && missingFields.length === 0 && reason !== 'never_analyzed') {
      return null;
    }

    if (!this.options.forceAll && reason === 'forced' && missingFields.length === 0) {
      return null;
    }

    return {
      contractId: metadata.contractId,
      reason,
      priority,
      lastAnalyzed: metadata.lastAnalyzed || 0,
      missingFields,
      estimatedEffort
    };
  }

  /**
   * Select candidates for refresh based on options and priorities
   */
  private selectCandidatesForRefresh(candidates: RefreshCandidate[]): RefreshCandidate[] {
    let selected = candidates;

    // Filter by priority if prioritizing errors
    if (this.options.prioritizeErrors) {
      selected = selected.filter(c => 
        c.reason === 'never_analyzed' || 
        c.reason === 'analysis_error' || 
        c.priority === 'high'
      );
    }

    // Apply batch size limit
    if (this.options.batchSize > 0) {
      selected = selected.slice(0, this.options.batchSize);
    }

    return selected;
  }

  /**
   * Refresh contracts in batches
   */
  private async refreshContractsBatch(candidates: RefreshCandidate[], result: RefreshResult): Promise<void> {
    console.log('\n🔄 Starting contract refresh...');

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    const analysisTimeouts: number[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const startTime = Date.now();

      try {
        console.log(`   [${i + 1}/${candidates.length}] Refreshing ${candidate.contractId}...`);

        // Get current state
        const beforeMetadata = await this.registry.getContract(candidate.contractId);
        const previousState = this.assessAnalysisState(beforeMetadata);

        // Perform refresh by re-adding the contract (triggers analysis)
        const refreshResult = await this.registry.addContract(candidate.contractId);
        
        if (refreshResult.success) {
          // Get updated state
          const afterMetadata = await this.registry.getContract(candidate.contractId);
          const newState = this.assessAnalysisState(afterMetadata);
          const analysisTime = Date.now() - startTime;
          
          analysisTimeouts.push(analysisTime);

          // Calculate improvement
          const improvementScore = this.calculateImprovementScore(beforeMetadata, afterMetadata);
          const fieldsUpdated = this.getUpdatedFields(beforeMetadata, afterMetadata);

          result.results.push({
            contractId: candidate.contractId,
            success: true,
            previousState,
            newState,
            improvementScore,
            analysisTime,
            fieldsUpdated
          });

          successCount++;

          if (this.options.verbose) {
            console.log(`     ✅ Success (${improvementScore}% improvement, ${fieldsUpdated.length} fields updated)`);
          }

        } else {
          result.results.push({
            contractId: candidate.contractId,
            success: false,
            previousState,
            newState: 'error',
            improvementScore: 0,
            analysisTime: Date.now() - startTime,
            error: refreshResult.error || 'Unknown error',
            fieldsUpdated: []
          });

          failCount++;
          console.log(`     ❌ Failed: ${refreshResult.error}`);
        }

      } catch (error) {
        result.results.push({
          contractId: candidate.contractId,
          success: false,
          previousState: 'error',
          newState: 'error',
          improvementScore: 0,
          analysisTime: Date.now() - startTime,
          error: String(error),
          fieldsUpdated: []
        });

        failCount++;
        console.log(`     ❌ Exception: ${error}`);
      }

      // Rate limiting between contracts
      if (i < candidates.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    result.overview.successfulRefresh = successCount;
    result.overview.failedRefresh = failCount;
    result.overview.skippedRefresh = skipCount;

    console.log(`\n📊 Refresh completed: ${successCount} successful, ${failCount} failed, ${skipCount} skipped`);
  }

  /**
   * Assess the analysis state of a contract
   */
  private assessAnalysisState(metadata: ContractMetadata | null): 'never_analyzed' | 'partial' | 'complete' | 'error' {
    if (!metadata) return 'error';

    const hasSourceCode = metadata.sourceCode && metadata.sourceCode.length > 0;
    const hasAbi = metadata.abi && metadata.abi.length > 0;
    const hasSourceMetadata = metadata.sourceMetadata !== undefined;
    const hasAnalysisTimestamp = metadata.lastAnalyzed && metadata.lastAnalyzed > 0;

    if (!hasAnalysisTimestamp) return 'never_analyzed';
    if (hasSourceCode && hasAbi && hasSourceMetadata) return 'complete';
    if (hasSourceCode || hasAbi || hasSourceMetadata) return 'partial';
    return 'error';
  }

  /**
   * Calculate improvement score between two metadata states
   */
  private calculateImprovementScore(before: ContractMetadata | null, after: ContractMetadata | null): number {
    if (!before || !after) return 0;

    let score = 0;
    let maxScore = 0;

    // Source code improvement
    maxScore += 30;
    if (!before.sourceCode && after.sourceCode) score += 30;
    else if (before.sourceCode && after.sourceCode && after.sourceCode.length > before.sourceCode.length) score += 10;

    // ABI improvement
    maxScore += 20;
    if (!before.abi && after.abi) score += 20;
    else if (before.abi && after.abi && after.abi.length > before.abi.length) score += 5;

    // Source metadata improvement
    maxScore += 25;
    if (!before.sourceMetadata && after.sourceMetadata) score += 25;

    // Traits improvement
    maxScore += 15;
    if (after.implementedTraits.length > before.implementedTraits.length) {
      score += Math.min(15, (after.implementedTraits.length - before.implementedTraits.length) * 5);
    }

    // Contract type improvement
    maxScore += 10;
    if (before.contractType === 'unknown' && after.contractType !== 'unknown') score += 10;

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }

  /**
   * Get list of fields that were updated
   */
  private getUpdatedFields(before: ContractMetadata | null, after: ContractMetadata | null): string[] {
    if (!before || !after) return [];

    const updatedFields: string[] = [];

    if (before.sourceCode !== after.sourceCode) updatedFields.push('sourceCode');
    if (before.abi !== after.abi) updatedFields.push('abi');
    if (!before.sourceMetadata && after.sourceMetadata) updatedFields.push('sourceMetadata');
    if (before.implementedTraits.length !== after.implementedTraits.length) updatedFields.push('implementedTraits');
    if (before.contractType !== after.contractType) updatedFields.push('contractType');
    if (before.lastAnalyzed !== after.lastAnalyzed) updatedFields.push('lastAnalyzed');

    return updatedFields;
  }

  /**
   * Generate summary and recommendations
   */
  private generateSummary(result: RefreshResult): void {
    console.log('\n📊 Generating summary...');

    // Count improvements by reason
    result.candidates.forEach(candidate => {
      const candidateResult = result.results.find(r => r.contractId === candidate.contractId);
      if (candidateResult && candidateResult.success) {
        result.summary.improvementsByReason[candidate.reason] = 
          (result.summary.improvementsByReason[candidate.reason] || 0) + 1;
      }
    });

    // Calculate average analysis time
    const successfulResults = result.results.filter(r => r.success);
    if (successfulResults.length > 0) {
      result.summary.averageAnalysisTime = Math.round(
        successfulResults.reduce((sum, r) => sum + r.analysisTime, 0) / successfulResults.length
      );
    }

    // Calculate total data improvement
    result.summary.totalDataImprovement = Math.round(
      successfulResults.reduce((sum, r) => sum + r.improvementScore, 0) / Math.max(1, successfulResults.length)
    );

    // Generate follow-up recommendations
    const failedResults = result.results.filter(r => !r.success);
    if (failedResults.length > 0) {
      result.summary.recommendedFollowUp.push(`Investigate ${failedResults.length} failed refresh attempts`);
    }

    const lowImprovementResults = successfulResults.filter(r => r.improvementScore < 30);
    if (lowImprovementResults.length > 0) {
      result.summary.recommendedFollowUp.push(`Review ${lowImprovementResults.length} contracts with low improvement scores`);
    }

    if (result.overview.successfulRefresh < result.overview.selectedForRefresh * 0.8) {
      result.summary.recommendedFollowUp.push('Consider investigating analysis infrastructure issues');
    }
  }

  /**
   * Finalize result with timing information
   */
  private finalizeResult(result: RefreshResult): RefreshResult {
    const endTime = Date.now();
    result.overview.endTime = new Date(endTime).toISOString();
    result.overview.duration = endTime - this.startTime;
    return result;
  }

  /**
   * Export refresh report
   */
  async exportReport(result: RefreshResult, filepath: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(filepath, JSON.stringify(result, null, 2));
    console.log(`\n📄 Refresh report exported to: ${filepath}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: RefreshOptions = {
    dryRun: !args.includes('--execute'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    forceAll: args.includes('--force-all'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '50'),
    maxContracts: parseInt(args.find(arg => arg.startsWith('--max-contracts='))?.split('=')[1] || '500'),
    maxAge: parseInt(args.find(arg => arg.startsWith('--max-age='))?.split('=')[1] || '30'),
    prioritizeErrors: args.includes('--prioritize-errors'),
    onlyMissingData: args.includes('--only-missing-data')
  };

  console.log('🔄 CONTRACT ANALYSIS REFRESH');
  console.log('='.repeat(45));
  console.log(`Mode: ${options.dryRun ? 'DRY-RUN (Preview Only)' : 'EXECUTION'}`);
  console.log(`Batch size: ${options.batchSize}`);
  console.log(`Max contracts: ${options.maxContracts}`);
  console.log(`Max age: ${options.maxAge} days`);
  console.log(`Force all: ${options.forceAll ? 'ON' : 'OFF'}`);
  console.log(`Prioritize errors: ${options.prioritizeErrors ? 'ON' : 'OFF'}`);
  console.log(`Only missing data: ${options.onlyMissingData ? 'ON' : 'OFF'}`);
  console.log();

  try {
    console.log('🔄 Initializing contract analysis refresher...');
    const refresher = new ContractAnalysisRefresher(options);
    
    console.log('📊 Refreshing contract analysis...');
    const result = await refresher.refresh();
    
    console.log('\n🔄 REFRESH RESULTS');
    console.log('='.repeat(30));
    
    // Overview
    console.log(`\n📊 OVERVIEW:`);
    console.log(`   Total candidates: ${result.overview.totalCandidates.toLocaleString()}`);
    console.log(`   Selected for refresh: ${result.overview.selectedForRefresh.toLocaleString()}`);
    if (!options.dryRun) {
      console.log(`   Successful: ${result.overview.successfulRefresh.toLocaleString()}`);
      console.log(`   Failed: ${result.overview.failedRefresh.toLocaleString()}`);
      console.log(`   Skipped: ${result.overview.skippedRefresh.toLocaleString()}`);
    }
    console.log(`   Duration: ${Math.round(result.overview.duration / 1000)}s`);
    
    // Candidates by Reason
    console.log(`\n📋 CANDIDATES BY REASON:`);
    if (result.candidates.length > 0) {
      const reasonCounts = result.candidates.reduce((acc, candidate) => {
        acc[candidate.reason] = (acc[candidate.reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(reasonCounts).forEach(([reason, count]) => {
        console.log(`   ${reason.replace(/_/g, ' ')}: ${count}`);
      });
    } else {
      console.log('   No candidates found - all contracts up to date');
    }
    
    // Results (if executed)
    if (!options.dryRun && result.results.length > 0) {
      console.log(`\n🎯 REFRESH RESULTS:`);
      console.log(`   Average improvement: ${result.summary.totalDataImprovement}%`);
      console.log(`   Average analysis time: ${result.summary.averageAnalysisTime}ms`);
      
      if (Object.keys(result.summary.improvementsByReason).length > 0) {
        console.log(`   Improvements by reason:`);
        Object.entries(result.summary.improvementsByReason).forEach(([reason, count]) => {
          console.log(`     ${reason.replace(/_/g, ' ')}: ${count}`);
        });
      }
      
      // Sample successful results
      if (options.verbose) {
        console.log(`   Sample successful refreshes:`);
        result.results
          .filter(r => r.success)
          .slice(0, 5)
          .forEach(r => {
            console.log(`     ${r.contractId}: ${r.previousState} → ${r.newState} (${r.improvementScore}% improvement)`);
          });
      }
      
      // Failed results
      const failedResults = result.results.filter(r => !r.success);
      if (failedResults.length > 0) {
        console.log(`   Failed refreshes:`);
        failedResults.slice(0, 5).forEach(r => {
          console.log(`     ${r.contractId}: ${r.error}`);
        });
        if (failedResults.length > 5) {
          console.log(`     ... and ${failedResults.length - 5} more failures`);
        }
      }
    }
    
    // Follow-up Recommendations
    if (result.summary.recommendedFollowUp.length > 0) {
      console.log(`\n💡 RECOMMENDED FOLLOW-UP:`);
      result.summary.recommendedFollowUp.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }
    
    // Next Steps
    console.log(`\n📋 NEXT STEPS:`);
    if (options.dryRun) {
      console.log('   1. Review the candidates above');
      console.log('   2. Run with --execute to perform actual refresh');
      console.log('   3. Use npm run script:inspect-mainnet to verify improvements');
    } else {
      console.log('   1. Run npm run script:inspect-mainnet to verify improvements');
      console.log('   2. Run npm run script:audit-data to check for remaining issues');
      console.log('   3. Address any failed refreshes if needed');
    }
    
    console.log('\n🎉 Refresh completed successfully!');
  } catch (err) {
    console.error('\n💥 Refresh failed:', err instanceof Error ? err.message : String(err));
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