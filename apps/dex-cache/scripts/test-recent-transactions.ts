#!/usr/bin/env tsx

/**
 * Script to test getRecentTransactions from @packages/polyglot
 * Usage: pnpm script test-recent-transactions.ts [limit] [type]
 */

import { getRecentTransactions } from '@repo/polyglot';

async function testGetRecentTransactions() {
  // Parse command line arguments
  const limit = process.argv[2] ? parseInt(process.argv[2]) : 10;
  const typeFilter = process.argv[3] as "coinbase" | "token_transfer" | "smart_contract" | "contract_call" | "poison_microblock" | undefined;
  
  console.log(`Testing getRecentTransactions with limit: ${limit}${typeFilter ? `, type: ${typeFilter}` : ''}\n`);
  
  try {
    const params = {
      limit,
      offset: 0,
      unanchored: false,
      ...(typeFilter && { type: [typeFilter] })
    };

    console.log('Calling getRecentTransactions with params:', params);
    const result = await getRecentTransactions(params);
    console.log('Raw result:', result);
    
    if (result && result.results) {
      console.log('=== TRANSACTION RESULTS SUMMARY ===');
      console.log(`Total transactions returned: ${result.results.length}`);
      console.log(`Total count from API: ${result.total || 'N/A'}`);
      console.log(`Limit: ${result.limit || 'N/A'}`);
      console.log(`Offset: ${result.offset || 'N/A'}`);
      
      // Analyze transaction types
      const typeCounts = result.results.reduce((acc, tx) => {
        acc[tx.tx_type] = (acc[tx.tx_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('\n=== TRANSACTION TYPE BREAKDOWN ===');
      Object.entries(typeCounts).forEach(([type, count]) => {
        console.log(`${type}: ${count}`);
      });
      
      // Show recent transactions details
      console.log('\n=== RECENT TRANSACTIONS (First 5) ===');
      result.results.slice(0, 5).forEach((tx, index) => {
        console.log(`\n${index + 1}. Transaction ID: ${tx.tx_id}`);
        console.log(`   Type: ${tx.tx_type}`);
        console.log(`   Status: ${tx.tx_status}`);
        console.log(`   Block Height: ${tx.block_height || 'Pending'}`);
        console.log(`   Fee Rate: ${tx.fee_rate || 'N/A'}`);
        
        if (tx.sender_address) {
          console.log(`   Sender: ${tx.sender_address}`);
        }
        
        // Show contract call details if applicable
        if (tx.tx_type === 'contract_call' && 'contract_call' in tx) {
          const contractCall = tx.contract_call;
          console.log(`   Contract: ${contractCall.contract_id}`);
          console.log(`   Function: ${contractCall.function_name}`);
        }
        
        // Show token transfer details if applicable
        if (tx.tx_type === 'token_transfer' && 'token_transfer' in tx) {
          const tokenTransfer = tx.token_transfer;
          console.log(`   Amount: ${tokenTransfer.amount} µSTX`);
          console.log(`   Recipient: ${tokenTransfer.recipient_address}`);
          if (tokenTransfer.memo) {
            console.log(`   Memo: ${tokenTransfer.memo}`);
          }
        }
        
        if (tx.block_time_iso) {
          console.log(`   Time: ${tx.block_time_iso}`);
        }
      });
      
      // Show first transaction in full detail
      console.log('\n=== FIRST TRANSACTION FULL DETAILS ===');
      console.log(JSON.stringify(result.results[0], null, 2));
      
    } else {
      console.log('No transactions returned or invalid response');
      console.log('Response:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    console.error('Full error:', error);
  }
}

// Show usage information
function showUsage() {
  console.log('Usage: pnpm script test-recent-transactions [limit] [type]');
  console.log('');
  console.log('Parameters:');
  console.log('  limit: Number of transactions to fetch (default: 10)');
  console.log('  type: Transaction type filter (optional)');
  console.log('        - coinbase');
  console.log('        - token_transfer');
  console.log('        - smart_contract');
  console.log('        - contract_call');
  console.log('        - poison_microblock');
  console.log('');
  console.log('Examples:');
  console.log('  pnpm script test-recent-transactions');
  console.log('  pnpm script test-recent-transactions 20');
  console.log('  pnpm script test-recent-transactions 15 contract_call');
  console.log('  pnpm script test-recent-transactions 5 token_transfer');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Run the test
testGetRecentTransactions().catch(console.error);