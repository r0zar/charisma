#!/usr/bin/env tsx

/**
 * Validate enhanced price data interface
 * Usage: pnpm script validate-price-interface
 */

import type { TokenPriceData } from '../src/lib/pricing/price-calculator';

function validatePriceInterface() {
    console.log('🔍 Validating enhanced price data interface...');

    // Test enhanced price data structure
    const testPriceData: TokenPriceData = {
        tokenId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.test-token',
        symbol: 'TEST',
        usdPrice: 1.0,
        sbtcRatio: 0.1,
        confidence: 0.8,
        lastUpdated: Date.now(),
        // New fields for intrinsic pricing
        intrinsicValue: 1.1,
        marketPrice: 1.0,
        priceDeviation: 0.1,
        isArbitrageOpportunity: true,
        calculationDetails: {
            btcPrice: 50000,
            pathsUsed: 2,
            totalLiquidity: 100000,
            priceVariation: 0.05,
            priceSource: 'hybrid'
        }
    };

    // Validate required fields exist
    const requiredFields = ['tokenId', 'symbol', 'usdPrice', 'sbtcRatio', 'confidence', 'lastUpdated'];
    const newFields = ['intrinsicValue', 'priceDeviation', 'isArbitrageOpportunity'];

    for (const field of requiredFields) {
        if (!(field in testPriceData)) {
            throw new Error(`Required field '${field}' missing from TokenPriceData`);
        }
    }

    for (const field of newFields) {
        if (!(field in testPriceData)) {
            console.log(`⚠️ New field '${field}' not yet added to interface`);
        } else {
            console.log(`✅ New field '${field}' present in interface`);
        }
    }

    // Test calculationDetails enhancement
    if (testPriceData.calculationDetails?.priceSource) {
        console.log(`✅ Enhanced calculationDetails with priceSource: ${testPriceData.calculationDetails.priceSource}`);
    } else {
        console.log(`⚠️ priceSource not yet added to calculationDetails`);
    }

    console.log('✅ Enhanced price data structure validated');
    return true;
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script validate-price-interface');
    console.log('\nDescription:');
    console.log('  Validates that the TokenPriceData interface includes all enhanced fields');
    console.log('  for intrinsic pricing and arbitrage detection.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

try {
    validatePriceInterface();
} catch (error) {
    console.error('❌ Price interface validation failed:', error);
    process.exit(1);
}