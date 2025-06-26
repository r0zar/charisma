#!/usr/bin/env tsx

/**
 * Validation script for LP calculator function exports
 * Usage: pnpm script validate-lp-calculator-export
 */

import { calculateLpIntrinsicValue, calculateAssetBreakdown, analyzeLpTokenPricing } from '../src/lib/pricing/lp-token-calculator';

async function validateLpCalculatorExports() {
    console.log('🔍 Validating LP calculator function exports...');

    try {
        // Check if functions are properly exported and callable
        console.log('calculateLpIntrinsicValue type:', typeof calculateLpIntrinsicValue);
        console.log('calculateAssetBreakdown type:', typeof calculateAssetBreakdown);
        console.log('analyzeLpTokenPricing type:', typeof analyzeLpTokenPricing);

        if (typeof calculateLpIntrinsicValue !== 'function') {
            throw new Error('calculateLpIntrinsicValue is not exported as function');
        }
        if (typeof calculateAssetBreakdown !== 'function') {
            throw new Error('calculateAssetBreakdown is not exported as function');
        }
        if (typeof analyzeLpTokenPricing !== 'function') {
            throw new Error('analyzeLpTokenPricing is not exported as function');
        }

        console.log('✅ All LP calculator functions exported correctly');
        return true;
    } catch (error) {
        console.error('❌ LP calculator export validation failed:', error);
        return false;
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script validate-lp-calculator-export');
    console.log('\nDescription:');
    console.log('  Validates that LP token calculator functions are properly exported');
    console.log('  and can be imported from the lp-token-calculator module.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the validation
validateLpCalculatorExports().catch(console.error);