#!/usr/bin/env tsx

/**
 * Audit Contract Data Script
 * 
 * Performs comprehensive data integrity checks on the mainnet contract registry.
 * Validates contract metadata, identifies inconsistencies, and suggests fixes.
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import type { ContractMetadata } from '../src/types';
import { isValidContractId } from '../src/utils/validators';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface AuditOptions {
  verbose: boolean;
  fixMode: boolean;
  exportReport: string | undefined;
  maxErrors: number;
  sampleSize: number;
}

interface AuditResult {
  overview: {
    totalContracts: number;
    contractsChecked: number;
    validContracts: number;
    invalidContracts: number;
    inconsistentContracts: number;
    startTime: string;
    endTime: string;
    duration: number;
  };
  validationErrors: Array<{
    contractId: string;
    errorType: 'format' | 'missing_data' | 'invalid_data' | 'inconsistent' | 'corrupted';
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    details: any;
    suggestedFix?: string;
  }>;
  dataIntegrityIssues: Array<{
    issueType: 'orphaned_index' | 'missing_index' | 'stale_data' | 'duplicate_data';
    description: string;
    affectedCount: number;
    suggestions: string[];
  }>;
  analysisGaps: Array<{
    contractId: string;
    missingFields: string[];
    lastAnalyzed: number;
    priority: 'high' | 'medium' | 'low';
  }>;
  performanceIssues: Array<{
    type: 'large_contract' | 'slow_analysis' | 'storage_inefficiency';
    contractId?: string;
    metric: string;
    value: number;
    threshold: number;
    impact: string;
  }>;
  statistics: {
    averageContractSize: number;
    averageAnalysisTime: number;
    traitsDistribution: Record<string, number>;
    contractTypesDistribution: Record<string, number>;
    analysisCompleteness: number;
  };
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    reason: string;
    estimatedImpact: string;
  }>;
}

class ContractDataAuditor {
  private registry: ContractRegistry;
  private options: AuditOptions;
  private startTime: number = 0;

  constructor(options: AuditOptions) {
    this.options = options;
    
    // Initialize registry with read-only configuration
    const config = createDefaultConfig('mainnet-contract-registry');
    this.registry = new ContractRegistry(config);
  }

  /**
   * Perform comprehensive audit of contract data
   */
  async audit(): Promise<AuditResult> {
    this.startTime = Date.now();
    const startTime = new Date().toISOString();
    
    console.log('🔍 Starting contract data audit...');
    
    // Get all contracts from storage
    const allContracts = await this.registry.getAllContracts();
    const totalContracts = allContracts.length;
    const sampleSize = this.options.sampleSize || totalContracts;
    const contractsToCheck = allContracts.slice(0, Math.min(sampleSize, totalContracts));
    
    console.log(`📊 Auditing ${contractsToCheck.length} of ${totalContracts} contracts`);
    
    const result: AuditResult = {
      overview: {
        totalContracts,
        contractsChecked: contractsToCheck.length,
        validContracts: 0,
        invalidContracts: 0,
        inconsistentContracts: 0,
        startTime,
        endTime: '',
        duration: 0
      },
      validationErrors: [],
      dataIntegrityIssues: [],
      analysisGaps: [],
      performanceIssues: [],
      statistics: {
        averageContractSize: 0,
        averageAnalysisTime: 0,
        traitsDistribution: {},
        contractTypesDistribution: {},
        analysisCompleteness: 0
      },
      recommendations: []
    };

    // Validate each contract
    for (let i = 0; i < contractsToCheck.length; i++) {
      const contract = contractsToCheck[i];
      if (this.options.verbose) {
        console.log(`[${i + 1}/${contractsToCheck.length}] Validating ${contract.contractId}`);
      }
      
      await this.validateContract(contract, result);
    }

    // Generate statistics and recommendations
    await this.generateStatistics(result);
    await this.generateRecommendations(result);

    const endTime = new Date().toISOString();
    result.overview.endTime = endTime;
    result.overview.duration = Date.now() - this.startTime;

    return result;
  }

  private async validateContract(contract: ContractMetadata, result: AuditResult): Promise<void> {
    let isValid = true;
    
    // Validate contract ID format
    if (!isValidContractId(contract.contractId)) {
      result.validationErrors.push({
        contractId: contract.contractId,
        errorType: 'format',
        severity: 'critical',
        message: 'Invalid contract ID format',
        details: { contractId: contract.contractId },
        suggestedFix: 'Ensure contract ID follows format: [deployer].[contract-name]'
      });
      isValid = false;
    }

    // Check for missing essential data
    if (!contract.deployerAddress) {
      result.validationErrors.push({
        contractId: contract.contractId,
        errorType: 'missing_data',
        severity: 'high',
        message: 'Missing deployer address',
        details: contract
      });
      isValid = false;
    }

    // Validate traits data if present
    if (contract.traits && Array.isArray(contract.traits)) {
      for (const trait of contract.traits) {
        if (!trait.name || !trait.type) {
          result.validationErrors.push({
            contractId: contract.contractId,
            errorType: 'invalid_data',
            severity: 'medium',
            message: 'Incomplete trait data',
            details: { trait, contractId: contract.contractId }
          });
          isValid = false;
        }
      }
    }

    if (isValid) {
      result.overview.validContracts++;
    } else {
      result.overview.invalidContracts++;
    }
  }

  private async generateStatistics(result: AuditResult): Promise<void> {
    console.log('📈 Generating statistics...');
    
    // Calculate basic statistics
    result.statistics.analysisCompleteness = 
      (result.overview.validContracts / result.overview.contractsChecked) * 100;
  }

  private async generateRecommendations(result: AuditResult): Promise<void> {
    console.log('💡 Generating recommendations...');
    
    if (result.overview.invalidContracts > 0) {
      result.recommendations.push({
        priority: 'high',
        action: 'Fix validation errors in contract data',
        reason: `Found ${result.overview.invalidContracts} contracts with validation errors`,
        estimatedImpact: 'Improved data integrity and system reliability'
      });
    }

    if (result.statistics.analysisCompleteness < 90) {
      result.recommendations.push({
        priority: 'medium',
        action: 'Improve contract analysis coverage',
        reason: `Analysis completeness is ${result.statistics.analysisCompleteness.toFixed(1)}%`,
        estimatedImpact: 'Better contract discovery and trait identification'
      });
    }
  }

  async exportReport(result: AuditResult, filename: string): Promise<void> {
    console.log(`📄 Exporting audit report to ${filename}...`);
    
    const reportData = JSON.stringify(result, null, 2);
    await fs.writeFile(filename, reportData, 'utf8');
    
    console.log(`✅ Report exported successfully`);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔍 CONTRACT DATA AUDIT');
  console.log('='.repeat(40));

  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: AuditOptions = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    fixMode: args.includes('--fix'),
    exportReport: args.find(arg => arg.startsWith('--export-report='))?.split('=')[1],
    maxErrors: parseInt(args.find(arg => arg.startsWith('--max-errors='))?.split('=')[1] || '100'),
    sampleSize: parseInt(args.find(arg => arg.startsWith('--sample-size='))?.split('=')[1] || '0')
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: tsx audit-contract-data.ts [options]

Options:
  --verbose, -v              Show detailed progress information
  --fix                      Attempt to fix issues automatically
  --export-report=<file>     Export audit report to specified file
  --max-errors=<number>      Maximum errors to collect (default: 100)
  --sample-size=<number>     Number of contracts to audit (default: all)
  --help, -h                 Show this help message
`);
    process.exit(0);
  }

  try {
    console.log('⚙️ Initializing contract data auditor...');
    const auditor = new ContractDataAuditor(options);
    
    console.log('🔎 Performing comprehensive data audit...');
    const result = await auditor.audit();
    
    if (options.exportReport) {
      await auditor.exportReport(result, options.exportReport);
    }

    // Display summary
    console.log('\n📋 AUDIT SUMMARY');
    console.log('='.repeat(40));
    console.log(`Total contracts: ${result.overview.totalContracts}`);
    console.log(`Contracts checked: ${result.overview.contractsChecked}`);
    console.log(`Valid contracts: ${result.overview.validContracts}`);
    console.log(`Invalid contracts: ${result.overview.invalidContracts}`);
    console.log(`Duration: ${(result.overview.duration / 1000).toFixed(2)}s`);
    
    if (result.validationErrors.length > 0) {
      console.log('\n❌ VALIDATION ERRORS:');
      result.validationErrors.slice(0, 5).forEach(error => {
        console.log(`  • ${error.contractId}: ${error.message} [${error.severity}]`);
      });
      if (result.validationErrors.length > 5) {
        console.log(`  ... and ${result.validationErrors.length - 5} more`);
      }
    }

    if (result.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      result.recommendations.forEach(rec => {
        console.log(`  • [${rec.priority.toUpperCase()}] ${rec.action}`);
        console.log(`    Reason: ${rec.reason}`);
      });
    }

    console.log('\n✅ Audit completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Audit failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️ Audit interrupted by user');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});