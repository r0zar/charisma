#!/usr/bin/env tsx

/**
 * Test script to validate energy token price fetching
 * Usage: npx tsx scripts/test-energy-prices.ts
 */

import { fetchEnergyTokenPrices, ENERGY_TOKENS } from '../src/lib/energy/price-service';
import { getMultipleTokenPrices, getTokenPrice } from '../src/lib/pricing/price-calculator';

console.log('🧪 Testing Energy Token Price Fetching\n');

async function testPriceFetching() {
    console.log('📋 Energy Token Contracts to test:');
    Object.entries(ENERGY_TOKENS).forEach(([key, contractId]) => {
        console.log(`  ${key}: ${contractId}`);
    });
    console.log('');

    // Test 1: Individual token price fetching
    console.log('🔍 Test 1: Individual token price fetching');
    for (const [tokenName, contractId] of Object.entries(ENERGY_TOKENS)) {
        try {
            console.log(`Testing ${tokenName} (${contractId})...`);
            const price = await getTokenPrice(contractId);
            if (price) {
                console.log(`✅ ${tokenName}: $${price.usdPrice.toFixed(6)} (confidence: ${(price.confidence * 100).toFixed(1)}%)`);
            } else {
                console.log(`❌ ${tokenName}: No price data available`);
            }
        } catch (error) {
            console.log(`❌ ${tokenName}: Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    console.log('');

    // Test 2: Bulk token price fetching
    console.log('🔍 Test 2: Bulk token price fetching');
    try {
        const tokenIds = Object.values(ENERGY_TOKENS);
        console.log('Fetching bulk prices for:', tokenIds);
        
        const priceMap = await getMultipleTokenPrices(tokenIds);
        console.log(`Received price map with ${priceMap.size} entries`);
        
        priceMap.forEach((price, tokenId) => {
            const tokenName = Object.keys(ENERGY_TOKENS).find(key => ENERGY_TOKENS[key as keyof typeof ENERGY_TOKENS] === tokenId);
            console.log(`✅ ${tokenName}: $${price.usdPrice.toFixed(6)} (confidence: ${(price.confidence * 100).toFixed(1)}%)`);
        });
    } catch (error) {
        console.log(`❌ Bulk fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    console.log('');

    // Test 3: Energy price service wrapper
    console.log('🔍 Test 3: Energy price service wrapper');
    try {
        const result = await fetchEnergyTokenPrices(false); // Don't use cache
        
        console.log('Service result:', {
            success: result.success,
            hasErrors: !!result.errors,
            errorCount: result.errors?.length || 0
        });

        if (result.success && result.prices) {
            const prices = result.prices;
            console.log('✅ Energy Price Service Results:');
            console.log(`  Energy: ${prices.energy ? `$${prices.energy.usdPrice.toFixed(6)}` : 'Not available'}`);
            console.log(`  HOOT: ${prices.hoot ? `$${prices.hoot.usdPrice.toFixed(6)}` : 'Not available'}`);
            console.log(`  Charisma: ${prices.charisma ? `$${prices.charisma.usdPrice.toFixed(6)}` : 'Not available'}`);
            console.log(`  Dexterity: ${prices.dexterity ? `$${prices.dexterity.usdPrice.toFixed(6)}` : 'Not available'}`);
            console.log(`  Overall confidence: ${(prices.confidence * 100).toFixed(1)}%`);
            console.log(`  Is stale: ${prices.isStale}`);
        } else {
            console.log('❌ Energy price service failed');
        }

        if (result.errors && result.errors.length > 0) {
            console.log('\n⚠️  Errors encountered:');
            result.errors.forEach(error => {
                console.log(`  ${error.token}: ${error.error}`);
            });
        }
    } catch (error) {
        console.log(`❌ Energy price service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    console.log('');

    // Test 4: Test specific problematic tokens
    console.log('🔍 Test 4: Testing specific token contracts');
    const testTokens = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
    ];

    for (const tokenId of testTokens) {
        try {
            console.log(`Direct test for ${tokenId}...`);
            const result = await getTokenPrice(tokenId);
            if (result) {
                console.log(`✅ Success: $${result.usdPrice.toFixed(6)}`);
            } else {
                console.log(`❌ No price returned`);
            }
        } catch (error) {
            console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// Run the tests
testPriceFetching()
    .then(() => {
        console.log('\n✨ Price testing complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Fatal error:', error);
        process.exit(1);
    });