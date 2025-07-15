#!/usr/bin/env node

/**
 * Test script to verify actual amount extraction functionality
 * Usage: pnpm script scripts/test-amount-extraction.ts
 */

import { logger } from './logger';
import { extractActualOutputAmount, extractUserTransfers } from '../src/lib/extract-actual-amounts';

async function testAmountExtraction() {
  await logger.info('🧪 Testing actual amount extraction functionality');
  
  try {
    // Test with the known real transaction
    const txid = '76fa8467d784479b0bb3d0b31255b7418d55bff76a35bb57c11edf06fb2ddb61';
    const userAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
    const expectedOutputToken = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
    
    await logger.info(`📊 Testing with transaction: ${txid}`);
    await logger.info(`👤 User address: ${userAddress}`);
    await logger.info(`🎯 Expected output token: ${expectedOutputToken}`);
    
    // Test 1: Extract actual output amount
    await logger.info('\n🔬 Test 1: Extracting actual output amount...');
    
    const actualAmount = await extractActualOutputAmount(txid, userAddress, expectedOutputToken);
    
    if (actualAmount) {
      await logger.success(`✅ SUCCESS! Extracted actual amount: ${actualAmount}`);
      
      // Compare with known expected value
      const expectedAmount = '756699';
      if (actualAmount === expectedAmount) {
        await logger.success(`🎯 PERFECT MATCH! Amount matches expected value: ${expectedAmount}`);
      } else {
        await logger.warn(`⚠️  Amount mismatch. Expected: ${expectedAmount}, Got: ${actualAmount}`);
      }
    } else {
      await logger.error(`❌ FAILED! Could not extract actual amount`);
    }
    
    // Test 2: Extract all user transfers for debugging
    await logger.info('\n🔬 Test 2: Extracting all user transfers...');
    
    const userTransfers = await extractUserTransfers(txid, userAddress);
    
    await logger.info(`📊 Found ${userTransfers.length} transfers to user:`);
    
    userTransfers.forEach((transfer, index) => {
      logger.info(`  Transfer ${index + 1}:`);
      logger.info(`    Asset: ${transfer.assetIdentifier}`);
      logger.info(`    Amount: ${transfer.amount}`);
      logger.info(`    Sender: ${transfer.sender}`);
      logger.info(`    Event Index: ${transfer.eventIndex}`);
    });
    
    // Test 3: Compare with quoted amount (from route metadata)
    await logger.info('\n🔬 Test 3: Slippage analysis...');
    
    if (actualAmount) {
      const quotedAmount = '775707'; // From the original route metadata
      const actualNum = parseInt(actualAmount);
      const quotedNum = parseInt(quotedAmount);
      const slippage = ((quotedNum - actualNum) / quotedNum) * 100;
      
      await logger.info(`📊 Slippage Analysis:`);
      await logger.info(`  Quoted Amount: ${quotedAmount}`);
      await logger.info(`  Actual Amount: ${actualAmount}`);
      await logger.info(`  Difference: ${quotedNum - actualNum} tokens`);
      await logger.info(`  Slippage: ${slippage.toFixed(2)}%`);
      
      if (slippage > 0) {
        await logger.warn(`⚠️  User received ${slippage.toFixed(2)}% less than quoted`);
      } else {
        await logger.success(`🎉 User received more than quoted!`);
      }
    }
    
    await logger.success('✅ Amount extraction testing completed');
    
  } catch (error) {
    await logger.error(`❌ Testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the test
testAmountExtraction().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});