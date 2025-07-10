#!/usr/bin/env node

/**
 * Transaction Lookup Test Script
 * Uses @packages/polyglot to fetch real transaction events for a given wallet address
 * Usage: node --import tsx scripts/test-tx-lookup.ts <wallet-address>
 */

import { syncLogger as logger } from '../utils/logger';
import { getTransactionEvents } from '@repo/polyglot';

// Parse command line arguments
const args = process.argv.slice(2);

function showHelp() {
  console.log(`
🔍 Transaction Lookup Test Script
==================================

Fetches real transaction events for a given Stacks wallet address using the Polyglot package.

Usage:
  node --import tsx scripts/test-tx-lookup.ts <wallet-address> [options]

Options:
  --limit <number>     Number of events to fetch (default: 100)
  --offset <number>    Number of events to skip (default: 0)
  --type <types>       Comma-separated list of event types to filter
                      Available types: smart_contract_log, stx_lock, stx_asset, 
                                      fungible_token_asset, non_fungible_token_asset
  --help, -h          Show this help message

Examples:
  node --import tsx scripts/test-tx-lookup.ts SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS
  node --import tsx scripts/test-tx-lookup.ts SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R --limit 50
  node --import tsx scripts/test-tx-lookup.ts SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R --type stx_asset,fungible_token_asset

Output:
  - Full transaction events response logged via logger.ts
  - Summary statistics
  - Error handling for invalid addresses or API issues
`);
}

function parseArgs(): {
  address?: string;
  limit?: number;
  offset?: number;
  type?: Array<'smart_contract_log' | 'stx_lock' | 'stx_asset' | 'fungible_token_asset' | 'non_fungible_token_asset'>;
} {
  const params: any = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--limit':
        params.limit = parseInt(args[++i]);
        break;
      case '--offset':
        params.offset = parseInt(args[++i]);
        break;
      case '--type':
        const types = args[++i].split(',') as any[];
        params.type = types;
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
        } else if (!params.address) {
          params.address = arg;
        }
    }
  }
  
  return params;
}

function validateAddress(address: string): boolean {
  // Basic Stacks address validation - mainnet (SP) or testnet (ST), 41 chars total
  const stacksAddressRegex = /^S[PT][0-9A-HJKMNP-Z]{39}$/;
  return stacksAddressRegex.test(address);
}

function validateParams(params: any): string[] {
  const errors: string[] = [];
  
  if (!params.address) {
    errors.push('Wallet address is required');
  } else if (!validateAddress(params.address)) {
    errors.push('Invalid Stacks address format');
  }
  
  if (params.limit !== undefined && (params.limit < 1 || params.limit > 1000)) {
    errors.push('Limit must be between 1 and 1000');
  }
  
  if (params.offset !== undefined && params.offset < 0) {
    errors.push('Offset must be non-negative');
  }
  
  if (params.type) {
    const validTypes = ['smart_contract_log', 'stx_lock', 'stx_asset', 'fungible_token_asset', 'non_fungible_token_asset'];
    const invalidTypes = params.type.filter((t: string) => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
      errors.push(`Invalid event types: ${invalidTypes.join(', ')}`);
    }
  }
  
  return errors;
}

function printSummary(response: any, address: string, params: any): void {
  console.log('\n📊 Transaction Events Summary:');
  console.log(`📍 Address: ${address}`);
  console.log(`📏 Limit: ${params.limit || 100}`);
  console.log(`⏭️  Offset: ${params.offset || 0}`);
  
  if (params.type) {
    console.log(`🏷️  Event Types: ${params.type.join(', ')}`);
  }
  
  if (response.events && response.events.length > 0) {
    console.log(`📋 Total Events Returned: ${response.events.length}`);
    console.log(`🔢 API Limit: ${response.limit || 'N/A'}`);
    console.log(`🔢 API Offset: ${response.offset || 'N/A'}`);
    
    // Event type breakdown
    const eventTypeCounts: Record<string, number> = {};
    response.events.forEach((event: any) => {
      const type = event.event_type;
      eventTypeCounts[type] = (eventTypeCounts[type] || 0) + 1;
    });
    
    console.log('\n📊 Event Type Breakdown:');
    Object.entries(eventTypeCounts).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    
    // Show first few transaction IDs
    const uniqueTxIds = [...new Set(response.events.map((e: any) => e.tx_id))];
    console.log(`\n🧾 Unique Transactions: ${uniqueTxIds.length}`);
    if (uniqueTxIds.length > 0) {
      console.log('📋 Sample Transaction IDs:');
      uniqueTxIds.slice(0, 3).forEach((txId: string) => {
        console.log(`   ${txId}`);
      });
      if (uniqueTxIds.length > 3) {
        console.log(`   ... and ${uniqueTxIds.length - 3} more`);
      }
    }
  } else {
    console.log('❌ No events found in response');
  }
}

async function main() {
  try {
    const startTime = Date.now();
    
    logger.info('🚀 Starting transaction events lookup: Fetch real blockchain transaction events for wallet address');
    
    // Parse and validate parameters
    const params = parseArgs();
    const validationErrors = validateParams(params);
    
    if (validationErrors.length > 0) {
      throw new Error(`Invalid parameters: ${validationErrors.join(', ')}`);
    }
    
    const { address, ...queryParams } = params;
    
    console.log('\n🔍 Starting transaction events lookup...');
    console.log(`📍 Address: ${address}`);
    console.log(`⚙️  Parameters:`, JSON.stringify(queryParams, null, 2));
    
    // Fetch transaction events
    logger.info('Fetching transaction events', {
      address,
      params: queryParams
    });
    
    console.log('\n📡 Calling Stacks API...');
    const response = await getTransactionEvents({
      address,
      ...queryParams
    });
    
    // Log full response
    await logger.info('Transaction events fetched successfully', {
      address,
      responseSize: JSON.stringify(response).length,
      eventCount: response.events?.length || 0,
      fullResponse: response,
      context: 'Transaction lookup'
    });
    
    // Print summary to console
    printSummary(response, address!, params);
    
    const duration = Date.now() - startTime;
    logger.success(`✅ Transaction events lookup completed (${duration}ms)`);
    
    console.log('\n✅ Transaction events lookup completed successfully!');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📊 Events found: ${response.events?.length || 0}`);
    console.log(`📋 Full response logged via logger.ts`);
    
  } catch (error) {
    logger.error(`Transaction events lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    
    console.log('\n❌ Transaction events lookup failed!');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    
    if (error instanceof Error && error.message.includes('Failed to fetch transaction events')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('   • Check if the Stacks address is valid');
      console.log('   • Verify network connectivity');
      console.log('   • Check if HIRO_API_KEY environment variable is set');
      console.log('   • Try reducing the limit parameter');
    }
    
    process.exit(1);
  }
}

// Execute main function
main().catch(async (error) => {
  logger.error(`Transaction events lookup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});