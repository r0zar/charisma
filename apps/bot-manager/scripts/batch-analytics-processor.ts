#!/usr/bin/env node

/**
 * Batch Analytics Processor
 * Processes analytics for multiple wallets and caches results
 * Usage: node --import tsx scripts/batch-analytics-processor.ts [options]
 */

import { logger, logExecution, logResult, logError } from './logger';
import { createAnalyticsClient } from '@/lib/analytics-client';
import { kv } from '@vercel/kv';
import { DEFAULT_ANALYTICS_CONFIG } from '@/lib/analytics-engine';

// Parse command line arguments
const args = process.argv.slice(2);

interface ProcessingOptions {
  wallets?: string[];
  walletsFile?: string;
  outputFile?: string;
  skipCache?: boolean;
  parallel?: number;
  profile?: string;
}

function parseArgs(): ProcessingOptions {
  const options: ProcessingOptions = {
    parallel: 3, // Default to 3 parallel processes
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--wallets':
        options.wallets = args[++i].split(',');
        break;
      case '--wallets-file':
        options.walletsFile = args[++i];
        break;
      case '--output':
        options.outputFile = args[++i];
        break;
      case '--skip-cache':
        options.skipCache = true;
        break;
      case '--parallel':
        options.parallel = parseInt(args[++i]);
        break;
      case '--profile':
        options.profile = args[++i];
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

function showHelp() {
  console.log(`
🔄 Batch Analytics Processor
============================

Processes analytics for multiple wallets and caches results for better performance.

Usage:
  node --import tsx scripts/batch-analytics-processor.ts [options]

Options:
  --wallets <list>          Comma-separated list of wallet addresses
  --wallets-file <file>     File containing wallet addresses (one per line)
  --output <file>           Output file for results (JSON format)
  --skip-cache              Skip cache and force fresh data
  --parallel <number>       Number of parallel processes (default: 3)
  --profile <name>          Analytics profile (development, production, etc.)
  --help, -h               Show this help message

Examples:
  node --import tsx scripts/batch-analytics-processor.ts --wallets SP123...,SP456...
  node --import tsx scripts/batch-analytics-processor.ts --wallets-file wallets.txt
  node --import tsx scripts/batch-analytics-processor.ts --output results.json --parallel 5

Output:
  - Processing statistics and performance metrics
  - Error handling for failed wallet analyses
  - Cached results for improved subsequent runs
`);
}

async function loadWalletsFromFile(filePath: string): Promise<string[]> {
  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));
  } catch (error) {
    throw new Error(`Failed to load wallets from file ${filePath}: ${error}`);
  }
}

function validateWalletAddress(address: string): boolean {
  // Basic Stacks address validation
  const stacksAddressRegex = /^S[PT][0-9A-HJKMNP-Z]{39}$/;
  return stacksAddressRegex.test(address);
}

async function processWallet(
  walletAddress: string,
  client: any,
  index: number,
  total: number
): Promise<{ address: string; success: boolean; data?: any; error?: string; processingTime: number }> {
  const startTime = Date.now();
  
  try {
    await logger.info(`Processing wallet ${index + 1}/${total}`, { 
      walletAddress: walletAddress.slice(0, 8) + '...',
      index: index + 1,
      total 
    });

    console.log(`[${index + 1}/${total}] Processing ${walletAddress.slice(0, 8)}...`);

    // Get comprehensive analytics summary
    const response = await client.getAnalyticsSummary(walletAddress);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to get analytics summary');
    }

    const processingTime = Date.now() - startTime;
    
    await logger.success(`Wallet processed successfully: ${walletAddress.slice(0, 8)}...`);
    
    return {
      address: walletAddress,
      success: true,
      data: response.data,
      processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await logger.error(`Failed to process wallet ${walletAddress.slice(0, 8)}...`, { 
      walletAddress, 
      error: errorMessage 
    });
    
    console.error(`❌ Failed to process ${walletAddress.slice(0, 8)}...: ${errorMessage}`);
    
    return {
      address: walletAddress,
      success: false,
      error: errorMessage,
      processingTime,
    };
  }
}

async function processBatch(
  wallets: string[], 
  batchSize: number, 
  client: any
): Promise<any[]> {
  const results: any[] = [];
  
  for (let i = 0; i < wallets.length; i += batchSize) {
    const batch = wallets.slice(i, i + batchSize);
    
    console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(wallets.length / batchSize)} (${batch.length} wallets)`);
    
    // Process batch in parallel
    const batchPromises = batch.map((wallet, index) => 
      processWallet(wallet, client, i + index, wallets.length)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Brief delay between batches to avoid overwhelming the API
    if (i + batchSize < wallets.length) {
      console.log('⏱️  Brief delay between batches...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

async function saveResults(results: any[], outputFile?: string): Promise<void> {
  if (!outputFile) return;
  
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputFile);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Prepare output data
    const outputData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalWallets: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        averageProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
      },
      results: results.map(r => ({
        address: r.address,
        success: r.success,
        error: r.error,
        processingTime: r.processingTime,
        dataAvailable: !!r.data,
        // Only include summary data, not full analytics to keep file size reasonable
        summary: r.data ? {
          portfolioValue: r.data.portfolio?.totalValue,
          totalReturn: r.data.performance?.totalReturn,
          totalTrades: r.data.performance?.totalTrades,
          holdingsCount: r.data.holdings?.length,
        } : null,
      })),
    };
    
    await fs.writeFile(outputFile, JSON.stringify(outputData, null, 2));
    console.log(`💾 Results saved to ${outputFile}`);
  } catch (error) {
    console.error(`Failed to save results: ${error}`);
  }
}

function printSummary(results: any[]): void {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0);
  
  console.log('\n📊 Batch Processing Summary:');
  console.log(`   • Total wallets: ${results.length}`);
  console.log(`   • Successful: ${successful.length}`);
  console.log(`   • Failed: ${failed.length}`);
  console.log(`   • Success rate: ${((successful.length / results.length) * 100).toFixed(1)}%`);
  console.log(`   • Total time: ${(totalProcessingTime / 1000).toFixed(1)}s`);
  console.log(`   • Average time per wallet: ${(totalProcessingTime / results.length / 1000).toFixed(2)}s`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed wallets:');
    failed.forEach(result => {
      console.log(`   ${result.address.slice(0, 8)}...: ${result.error}`);
    });
  }
  
  if (successful.length > 0) {
    console.log('\n💰 Analytics Summary:');
    const totalValue = successful.reduce((sum, r) => sum + (r.data?.portfolio?.totalValue || 0), 0);
    const totalReturn = successful.reduce((sum, r) => sum + (r.data?.performance?.totalReturn || 0), 0);
    const totalTrades = successful.reduce((sum, r) => sum + (r.data?.performance?.totalTrades || 0), 0);
    
    console.log(`   • Combined portfolio value: $${totalValue.toFixed(2)}`);
    console.log(`   • Combined total return: $${totalReturn.toFixed(2)}`);
    console.log(`   • Combined total trades: ${totalTrades}`);
  }
}

async function main() {
  try {
    const startTime = Date.now();
    
    await logExecution('Starting batch analytics processing', 'Process analytics for multiple wallets');
    
    // Parse options
    const options = parseArgs();
    
    // Get wallet addresses
    let wallets: string[] = [];
    
    if (options.wallets) {
      wallets = options.wallets;
    } else if (options.walletsFile) {
      wallets = await loadWalletsFromFile(options.walletsFile);
    } else {
      throw new Error('Must provide either --wallets or --wallets-file');
    }
    
    // Validate wallet addresses
    const invalidWallets = wallets.filter(wallet => !validateWalletAddress(wallet));
    if (invalidWallets.length > 0) {
      throw new Error(`Invalid wallet addresses: ${invalidWallets.join(', ')}`);
    }
    
    console.log(`🎯 Starting batch analytics processing for ${wallets.length} wallets`);
    console.log(`⚙️  Parallel processes: ${options.parallel}`);
    console.log(`💾 Output file: ${options.outputFile || 'None'}`);
    console.log(`🔄 Skip cache: ${options.skipCache || false}`);
    
    // Create analytics client with custom config
    const config = {
      ...DEFAULT_ANALYTICS_CONFIG,
      cacheEnabled: !options.skipCache,
    };
    
    const { createAnalyticsClient } = await import('@/lib/analytics-client');
    const client = createAnalyticsClient(config);
    
    await logger.info('Batch processing started', {
      walletCount: wallets.length,
      parallelProcesses: options.parallel,
      cacheEnabled: !options.skipCache,
    });
    
    // Process wallets in batches
    const results = await processBatch(wallets, options.parallel || 3, client);
    
    // Save results if output file specified
    if (options.outputFile) {
      await saveResults(results, options.outputFile);
    }
    
    // Print summary
    printSummary(results);
    
    const duration = Date.now() - startTime;
    await logResult('Batch analytics processing', {
      exitCode: 0,
      stdout: 'Batch processing completed successfully',
      summary: {
        totalWallets: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        duration: `${duration}ms`,
        outputFile: options.outputFile,
      }
    }, duration);
    
    console.log('\n✅ Batch analytics processing completed!');
    console.log(`⏱️  Total duration: ${(duration / 1000).toFixed(1)}s`);
    
  } catch (error) {
    await logError('Batch analytics processing failed', error instanceof Error ? error : new Error(String(error)));
    
    console.error('\n❌ Batch analytics processing failed!');
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    
    process.exit(1);
  }
}

// Execute main function
main().catch(async (error) => {
  await logError('Batch analytics processing failed', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});