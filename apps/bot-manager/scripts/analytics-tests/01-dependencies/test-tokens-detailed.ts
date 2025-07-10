#!/usr/bin/env node

/**
 * Detailed Tokens Integration Analysis
 * Comparing direct fetch vs getPrices function response
 * Usage: node --import tsx scripts/analytics-tests/01-dependencies/test-tokens-detailed.ts
 */

import { getPrices } from '@repo/tokens';
import { logger } from '../../logger';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function compareRequests() {
  const baseUrl = process.env.PARTYKIT_URL || 'http://localhost:1999';
  const testTokens = ['.stx', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'];
  
  console.log('🔍 Comparing Direct Fetch vs getPrices Function');
  console.log('=================================================');
  
  // Direct fetch
  console.log('\n1️⃣ Direct Fetch Test:');
  const tokensParam = testTokens.join(',');
  const directUrl = `${baseUrl}/parties/prices/main?tokens=${encodeURIComponent(tokensParam)}`;
  console.log(`📡 URL: ${directUrl}`);
  
  try {
    const directResponse = await fetch(directUrl);
    const directData = await directResponse.json();
    console.log(`✅ Direct fetch success: ${directData.prices?.length || 0} prices`);
    if (directData.prices) {
      directData.prices.forEach((price: any) => {
        console.log(`   💰 ${price.contractId}: $${price.price?.toFixed(6)}`);
      });
    }
  } catch (error) {
    console.error(`❌ Direct fetch failed: ${error}`);
  }
  
  // getPrices function
  console.log('\n2️⃣ getPrices Function Test:');
  try {
    const functionResult = await getPrices(testTokens);
    console.log(`📊 getPrices result: ${functionResult.prices?.length || 0} prices`);
    console.log(`🎉 Party: ${functionResult.party}`);
    console.log(`🕐 Server time: ${functionResult.serverTime}`);
    
    if (functionResult.prices && functionResult.prices.length > 0) {
      functionResult.prices.forEach((price) => {
        console.log(`   💰 ${price.contractId}: $${price.price?.toFixed(6)}`);
      });
    } else {
      console.log('❌ No prices in getPrices response');
    }
  } catch (error) {
    console.error(`❌ getPrices failed: ${error}`);
  }
  
  // Wait and retry
  console.log('\n3️⃣ Retry After 2 Second Delay:');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    const retryResult = await getPrices(testTokens);
    console.log(`📊 Retry result: ${retryResult.prices?.length || 0} prices`);
    if (retryResult.prices && retryResult.prices.length > 0) {
      retryResult.prices.forEach((price) => {
        console.log(`   💰 ${price.contractId}: $${price.price?.toFixed(6)}`);
      });
    } else {
      console.log('❌ Still no prices in retry response');
    }
  } catch (error) {
    console.error(`❌ Retry failed: ${error}`);
  }
  
  // Single token test
  console.log('\n4️⃣ Single Token Test:');
  try {
    const singleResult = await getPrices('.stx');
    console.log(`📊 Single token result: ${singleResult.prices?.length || 0} prices`);
    if (singleResult.prices && singleResult.prices.length > 0) {
      singleResult.prices.forEach((price) => {
        console.log(`   💰 ${price.contractId}: $${price.price?.toFixed(6)}`);
      });
    } else {
      console.log('❌ No prices in single token response');
    }
  } catch (error) {
    console.error(`❌ Single token failed: ${error}`);
  }
}

async function main() {
  try {
    logger.info('Script session started');
    logger.info('Executing: Detailed Tokens Integration Analysis');
    
    await compareRequests();
    
    logger.info('Completed: Detailed Tokens Integration Analysis');
    console.log('\n🎉 Analysis complete!');
    
  } catch (error) {
    console.error('\n❌ Analysis failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute main function
main().catch(console.error);