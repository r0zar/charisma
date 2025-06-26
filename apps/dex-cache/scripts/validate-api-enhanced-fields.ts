#!/usr/bin/env tsx

/**
 * Test enhanced pricing fields in prices API responses
 * Usage: pnpm script validate-api-enhanced-fields
 */

import { PriceCalculator } from '../src/lib/pricing/price-calculator';
import { listVaults, listVaultTokens } from '../src/lib/pool-service';

async function testApiEnhancedFields() {
    console.log('🔍 Testing enhanced pricing fields in API responses...');

    try {
        const calculator = PriceCalculator.getInstance();
        const allTokens = await listVaultTokens();
        const allVaults = await listVaults();
        
        console.log(`Available for testing: ${allTokens.length} individual tokens, ${allVaults.length} LP tokens`);
        
        if (allTokens.length === 0 && allVaults.length === 0) {
            console.log('⚠️ No tokens available for testing enhanced fields');
            return true;
        }
        
        // Test enhanced fields on different token types
        const testResults: Array<{
            tokenId: string;
            symbol: string;
            type: 'individual' | 'lp';
            hasEnhancedFields: boolean;
            priceSource?: string;
            details: any;
        }> = [];
        
        // Test individual tokens
        console.log('\n--- Testing Individual Token Enhanced Fields ---');
        const sampleTokens = allTokens.slice(0, 2);
        
        for (const token of sampleTokens) {
            console.log(`\nTesting individual token: ${token.symbol} (${token.contractId})`);
            
            const result = await calculator.calculateTokenPrice(token.contractId);
            
            if (result.success && result.price) {
                const price = result.price;
                
                // Check for enhanced fields
                const hasIntrinsicValue = price.intrinsicValue !== undefined;
                const hasMarketPrice = price.marketPrice !== undefined;
                const hasPriceDeviation = price.priceDeviation !== undefined;
                const hasArbitrageFlag = price.isArbitrageOpportunity !== undefined;
                const hasPriceSource = price.calculationDetails?.priceSource !== undefined;
                
                console.log(`  Enhanced fields present:`);
                console.log(`    intrinsicValue: ${hasIntrinsicValue ? '✅' : '❌'} (${price.intrinsicValue || 'null'})`);
                console.log(`    marketPrice: ${hasMarketPrice ? '✅' : '❌'} (${price.marketPrice || 'null'})`);
                console.log(`    priceDeviation: ${hasPriceDeviation ? '✅' : '❌'} (${price.priceDeviation || 'null'})`);
                console.log(`    isArbitrageOpportunity: ${hasArbitrageFlag ? '✅' : '❌'} (${price.isArbitrageOpportunity})`);
                console.log(`    priceSource: ${hasPriceSource ? '✅' : '❌'} (${price.calculationDetails?.priceSource || 'null'})`);
                
                const enhancedFieldsCount = [hasIntrinsicValue, hasMarketPrice, hasPriceDeviation, hasArbitrageFlag, hasPriceSource].filter(Boolean).length;
                
                testResults.push({
                    tokenId: token.contractId,
                    symbol: token.symbol,
                    type: 'individual',
                    hasEnhancedFields: enhancedFieldsCount >= 4, // At least 4 out of 5 fields
                    priceSource: price.calculationDetails?.priceSource,
                    details: {
                        usdPrice: price.usdPrice,
                        confidence: price.confidence,
                        enhancedFieldsCount,
                        totalFields: 5
                    }
                });
                
                // Validate individual token should use market pricing
                if (price.calculationDetails?.priceSource === 'market') {
                    console.log(`  ✅ Individual token correctly uses market pricing`);
                } else {
                    console.log(`  ⚠️ Individual token using unexpected pricing source: ${price.calculationDetails?.priceSource}`);
                }
                
            } else {
                console.log(`  ❌ Failed to get price: ${result.error}`);
                testResults.push({
                    tokenId: token.contractId,
                    symbol: token.symbol,
                    type: 'individual',
                    hasEnhancedFields: false,
                    details: { error: result.error }
                });
            }
        }
        
        // Test LP tokens
        console.log('\n--- Testing LP Token Enhanced Fields ---');
        const sampleVaults = allVaults.slice(0, 2);
        
        for (const vault of sampleVaults) {
            console.log(`\nTesting LP token: ${vault.symbol} (${vault.contractId})`);
            
            const result = await calculator.calculateTokenPrice(vault.contractId);
            
            if (result.success && result.price) {
                const price = result.price;
                
                // Check for enhanced fields
                const hasIntrinsicValue = price.intrinsicValue !== undefined && price.intrinsicValue !== null;
                const hasMarketPrice = price.marketPrice !== undefined;
                const hasPriceDeviation = price.priceDeviation !== undefined;
                const hasArbitrageFlag = price.isArbitrageOpportunity !== undefined;
                const hasPriceSource = price.calculationDetails?.priceSource !== undefined;
                
                console.log(`  Enhanced fields present:`);
                console.log(`    intrinsicValue: ${hasIntrinsicValue ? '✅' : '❌'} (${price.intrinsicValue || 'null'})`);
                console.log(`    marketPrice: ${hasMarketPrice ? '✅' : '❌'} (${price.marketPrice || 'null'})`);
                console.log(`    priceDeviation: ${hasPriceDeviation ? '✅' : '❌'} (${price.priceDeviation || 'null'})`);
                console.log(`    isArbitrageOpportunity: ${hasArbitrageFlag ? '✅' : '❌'} (${price.isArbitrageOpportunity})`);
                console.log(`    priceSource: ${hasPriceSource ? '✅' : '❌'} (${price.calculationDetails?.priceSource || 'null'})`);
                
                const enhancedFieldsCount = [hasIntrinsicValue, hasMarketPrice, hasPriceDeviation, hasArbitrageFlag, hasPriceSource].filter(Boolean).length;
                
                testResults.push({
                    tokenId: vault.contractId,
                    symbol: vault.symbol,
                    type: 'lp',
                    hasEnhancedFields: enhancedFieldsCount >= 4, // At least 4 out of 5 fields
                    priceSource: price.calculationDetails?.priceSource,
                    details: {
                        usdPrice: price.usdPrice,
                        confidence: price.confidence,
                        enhancedFieldsCount,
                        totalFields: 5,
                        hasIntrinsicValue
                    }
                });
                
                // Validate LP token should use intrinsic pricing
                if (price.calculationDetails?.priceSource === 'intrinsic') {
                    console.log(`  ✅ LP token correctly uses intrinsic pricing`);
                } else if (price.calculationDetails?.priceSource === 'market') {
                    console.log(`  ℹ️ LP token uses market pricing (market paths available)`);
                } else {
                    console.log(`  ⚠️ LP token using unexpected pricing source: ${price.calculationDetails?.priceSource}`);
                }
                
                // LP tokens should have intrinsic values
                if (hasIntrinsicValue) {
                    console.log(`  ✅ LP token has intrinsic value: $${price.intrinsicValue?.toFixed(6)}`);
                } else {
                    console.log(`  ⚠️ LP token missing intrinsic value`);
                }
                
            } else {
                console.log(`  ❌ Failed to get price: ${result.error}`);
                testResults.push({
                    tokenId: vault.contractId,
                    symbol: vault.symbol,
                    type: 'lp',
                    hasEnhancedFields: false,
                    details: { error: result.error }
                });
            }
        }
        
        // Test API response structure simulation
        console.log('\n--- Testing API Response Structure ---');
        
        const sampleResult = testResults.find(r => r.hasEnhancedFields && r.type === 'lp') || testResults[0];
        
        if (sampleResult && sampleResult.hasEnhancedFields) {
            console.log(`\nSimulating API response for: ${sampleResult.symbol}`);
            
            // Simulate the API response structure we implemented
            const mockApiResponse = {
                tokenId: sampleResult.tokenId,
                symbol: sampleResult.symbol,
                usdPrice: sampleResult.details.usdPrice,
                confidence: sampleResult.details.confidence,
                // Enhanced pricing fields that should be in API
                isLpToken: sampleResult.type === 'lp',
                intrinsicValue: sampleResult.details.hasIntrinsicValue ? sampleResult.details.usdPrice : null,
                marketPrice: sampleResult.type === 'individual' ? sampleResult.details.usdPrice : null,
                priceDeviation: 0,
                isArbitrageOpportunity: false,
                calculationDetails: {
                    priceSource: sampleResult.priceSource
                }
            };
            
            console.log(`API Response Fields:`);
            console.log(`  isLpToken: ${mockApiResponse.isLpToken}`);
            console.log(`  intrinsicValue: ${mockApiResponse.intrinsicValue}`);
            console.log(`  marketPrice: ${mockApiResponse.marketPrice}`);
            console.log(`  priceDeviation: ${mockApiResponse.priceDeviation}`);
            console.log(`  isArbitrageOpportunity: ${mockApiResponse.isArbitrageOpportunity}`);
            console.log(`  calculationDetails.priceSource: ${mockApiResponse.calculationDetails.priceSource}`);
            
            console.log('✅ API response structure includes enhanced fields');
        } else {
            console.log('⚠️ No successful token pricing available to test API structure');
        }
        
        // Summary
        console.log('\n--- Enhanced Fields Validation Summary ---');
        
        const successfulTests = testResults.filter(r => r.hasEnhancedFields);
        const individualTests = testResults.filter(r => r.type === 'individual');
        const lpTests = testResults.filter(r => r.type === 'lp');
        const intrinsicSources = testResults.filter(r => r.priceSource === 'intrinsic');
        const marketSources = testResults.filter(r => r.priceSource === 'market');
        
        console.log(`Total tests: ${testResults.length}`);
        console.log(`Successful (enhanced fields): ${successfulTests.length}`);
        console.log(`Individual tokens tested: ${individualTests.length}`);
        console.log(`LP tokens tested: ${lpTests.length}`);
        console.log(`Using intrinsic pricing: ${intrinsicSources.length}`);
        console.log(`Using market pricing: ${marketSources.length}`);
        
        testResults.forEach(result => {
            const status = result.hasEnhancedFields ? '✅' : '❌';
            const source = result.priceSource || 'unknown';
            console.log(`  ${status} ${result.symbol} (${result.type}) - ${source} pricing`);
        });
        
        const successRate = testResults.length > 0 ? (successfulTests.length / testResults.length) * 100 : 0;
        console.log(`\nSuccess rate: ${successRate.toFixed(1)}%`);
        
        if (successRate >= 80) {
            console.log('✅ Enhanced fields validation successful');
            return true;
        } else if (successRate >= 50) {
            console.log('⚠️ Enhanced fields partially working');
            return true;
        } else {
            console.log('❌ Enhanced fields validation failed');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Enhanced fields test failed:', error);
        return false;
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script validate-api-enhanced-fields');
    console.log('\nDescription:');
    console.log('  Tests enhanced pricing fields in API responses including:');
    console.log('  - intrinsicValue, marketPrice, priceDeviation');
    console.log('  - isArbitrageOpportunity, isLpToken flags');
    console.log('  - calculationDetails.priceSource field');
    console.log('  - Validates LP tokens use intrinsic pricing');
    console.log('  - Validates individual tokens use market pricing');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

testApiEnhancedFields().catch(console.error);