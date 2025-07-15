#!/usr/bin/env node

/**
 * Test script to analyze transaction events structure
 * Usage: pnpm script scripts/test-transaction-events.ts
 */

import { logger } from './logger';
import { getTransactionDetails, getTransactionEvents } from '@repo/polyglot';

async function testTransactionEvents() {
  await logger.info('🔍 Starting transaction events analysis');
  
  try {
    // Test with the known real transaction
    const txid = '76fa8467d784479b0bb3d0b31255b7418d55bff76a35bb57c11edf06fb2ddb61';
    const userAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
    const expectedOutputToken = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
    
    await logger.info(`📊 Analyzing transaction: ${txid}`);
    await logger.info(`👤 User address: ${userAddress}`);
    await logger.info(`🎯 Expected output token: ${expectedOutputToken}`);
    
    // Step 1: Get complete transaction details
    await logger.info('\n📋 Step 1: Getting complete transaction details...');
    
    const txDetails = await getTransactionDetails(txid);
    
    await logger.info(`📊 Transaction Overview:`);
    await logger.info(`  TX Status: ${txDetails.tx_status}`);
    await logger.info(`  TX Type: ${txDetails.tx_type}`);
    await logger.info(`  Block Height: ${txDetails.block_height}`);
    await logger.info(`  Event Count: ${txDetails.event_count}`);
    await logger.info(`  Sender: ${txDetails.sender_address}`);
    
    if (txDetails.tx_type === 'contract_call') {
      await logger.info(`  Contract Called: ${(txDetails as any).contract_call?.contract_id}`);
      await logger.info(`  Function: ${(txDetails as any).contract_call?.function_name}`);
    }
    
    // Step 2: Analyze all events
    await logger.info('\n📋 Step 2: Analyzing all transaction events...');
    
    if (!txDetails.events || txDetails.events.length === 0) {
      await logger.warn('⚠️ No events found in transaction');
      return;
    }
    
    await logger.info(`📊 Found ${txDetails.events.length} events`);
    
    // Log all events with their structure
    for (let i = 0; i < txDetails.events.length; i++) {
      const event = txDetails.events[i];
      
      await logger.info(`\n📋 Event ${i + 1}:`);
      await logger.info(`  Type: ${event.event_type}`);
      await logger.info(`  Index: ${event.event_index}`);
      
      // Log the complete event structure
      await logger.info(`  Complete Structure: ${JSON.stringify(event, null, 2)}`);
      
      // Focus on fungible token events
      if (event.event_type === 'fungible_token_asset') {
        await logger.info(`\n🔍 FUNGIBLE TOKEN EVENT ANALYSIS:`);
        await logger.info(`  Asset Identifier: ${event.asset?.asset_identifier}`);
        await logger.info(`  Asset Event Type: ${event.asset?.asset_event_type}`);
        await logger.info(`  Sender: ${event.asset?.sender}`);
        await logger.info(`  Recipient: ${event.asset?.recipient}`);
        await logger.info(`  Amount: ${event.asset?.amount}`);
        
        // Check if this is a transfer TO our user
        if (event.asset?.recipient === userAddress) {
          await logger.success(`  ✅ TRANSFER TO USER FOUND!`);
          
          // Check if this is our expected output token
          if (event.asset?.asset_identifier === expectedOutputToken) {
            await logger.success(`  🎯 EXPECTED OUTPUT TOKEN MATCH!`);
            await logger.success(`  💰 ACTUAL AMOUNT RECEIVED: ${event.asset.amount}`);
          }
        }
      }
      
      // Also analyze other event types for context
      if (event.event_type === 'stx_asset') {
        await logger.info(`\n💰 STX ASSET EVENT:`);
        await logger.info(`  Asset Event Type: ${event.asset?.asset_event_type}`);
        await logger.info(`  Sender: ${event.asset?.sender}`);
        await logger.info(`  Recipient: ${event.asset?.recipient}`);
        await logger.info(`  Amount: ${event.asset?.amount}`);
      }
      
      if (event.event_type === 'smart_contract_log') {
        await logger.info(`\n📜 CONTRACT LOG EVENT:`);
        await logger.info(`  Contract ID: ${event.contract_log?.contract_id}`);
        await logger.info(`  Topic: ${event.contract_log?.topic}`);
        // Note: contract_log.value contains hex data that would need decoding
      }
    }
    
    // Step 3: Test getTransactionEvents function
    await logger.info('\n📋 Step 3: Testing getTransactionEvents function...');
    
    const eventsResponse = await getTransactionEvents({
      tx_id: txid,
      type: ['fungible_token_asset']
    });
    
    await logger.info(`📊 getTransactionEvents response:`);
    await logger.info(JSON.stringify(eventsResponse, null, 2));
    
    // Step 4: Summary and recommendations
    await logger.info('\n📋 Step 4: Analysis Summary...');
    
    const fungibleEvents = txDetails.events.filter(e => e.event_type === 'fungible_token_asset');
    const transfersToUser = fungibleEvents.filter(e => e.asset?.recipient === userAddress);
    const outputTokenTransfers = transfersToUser.filter(e => e.asset?.asset_identifier === expectedOutputToken);
    
    await logger.info(`📊 Event Summary:`);
    await logger.info(`  Total Events: ${txDetails.events.length}`);
    await logger.info(`  Fungible Token Events: ${fungibleEvents.length}`);
    await logger.info(`  Transfers to User: ${transfersToUser.length}`);
    await logger.info(`  Output Token Transfers: ${outputTokenTransfers.length}`);
    
    if (outputTokenTransfers.length > 0) {
      const finalTransfer = outputTokenTransfers[outputTokenTransfers.length - 1];
      await logger.success(`\n🎉 SUCCESS! Found actual output amount:`);
      await logger.success(`  Token: ${finalTransfer.asset.asset_identifier}`);
      await logger.success(`  Amount: ${finalTransfer.asset.amount}`);
      await logger.success(`  Recipient: ${finalTransfer.asset.recipient}`);
    } else {
      await logger.warn(`\n⚠️ No output token transfers found to user address`);
    }
    
    await logger.success('✅ Transaction events analysis completed');
    
  } catch (error) {
    await logger.error(`❌ Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the test
testTransactionEvents().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});