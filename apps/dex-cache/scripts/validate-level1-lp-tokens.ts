#!/usr/bin/env tsx

/**
 * Validate Level 1 LP token processing (NTEN, DEX-CORGI, etc)
 * Tests dependency-aware intrinsic pricing for nested LP tokens
 * Usage: pnpm script validate-level1-lp-tokens
 */

import { getLpDependencyGraph } from '@/lib/pricing/lp-dependency-graph';
import { calculateAllLpIntrinsicValues } from '@/lib/pricing/lp-processing-queue';
import { getMultipleTokenPrices } from '@/lib/pricing/price-calculator';

async function main() {
    console.log('🔍 Validating Level 1 LP token processing...\n');
    
    try {
        // Step 1: Build dependency graph
        console.log('=== STEP 1: BUILD DEPENDENCY GRAPH ===');
        const dependencyGraph = await getLpDependencyGraph();
        const stats = dependencyGraph.getStats();
        
        console.log(`Total LP tokens: ${stats.totalLpTokens}`);
        console.log(`Dependency levels: ${stats.levelCount}`);
        console.log('Level distribution:', stats.levelDistribution);
        
        if (stats.circularDependencies.length > 0) {
            console.warn('⚠️  Circular dependencies detected:', stats.circularDependencies);
        }
        
        // Get Level 1 tokens
        const level1Tokens = dependencyGraph.getTokensAtLevel(1);
        console.log(`\nLevel 1 LP tokens (${level1Tokens.length}):`, level1Tokens);
        
        if (level1Tokens.length === 0) {
            console.log('✅ No Level 1 LP tokens found - all LP tokens are Level 0');
            return;
        }
        
        // Step 2: Analyze Level 1 dependencies
        console.log('\n=== STEP 2: ANALYZE LEVEL 1 DEPENDENCIES ===');
        level1Tokens.forEach(contractId => {
            const dependency = dependencyGraph.getDependency(contractId);
            if (dependency) {
                console.log(`\n${dependency.symbol} (${contractId}):`);
                console.log(`  TokenA: ${dependency.tokenA.symbol} (${dependency.tokenA.contractId}) - LP: ${dependency.tokenA.isLpToken}`);
                console.log(`  TokenB: ${dependency.tokenB.symbol} (${dependency.tokenB.contractId}) - LP: ${dependency.tokenB.isLpToken}`);
                console.log(`  Dependencies: ${dependency.dependencies.length} LP tokens`);
                dependency.dependencies.forEach(depId => {
                    const depInfo = dependencyGraph.getDependency(depId);
                    console.log(`    - ${depInfo?.symbol || 'Unknown'} (${depId})`);
                });
            }
        });
        
        // Step 3: Get base token prices
        console.log('\n=== STEP 3: GET BASE TOKEN PRICES ===');
        const basePrices: Record<string, number> = {};
        
        // Collect all base token dependencies
        const baseTokenIds = new Set<string>();
        level1Tokens.forEach(contractId => {
            const dependency = dependencyGraph.getDependency(contractId);
            if (dependency) {
                // Add direct dependencies (which should be Level 0 LP tokens)
                dependency.dependencies.forEach(depId => {
                    const depDependency = dependencyGraph.getDependency(depId);
                    if (depDependency) {
                        // Add the underlying tokens of the Level 0 LP tokens
                        if (!depDependency.tokenA.isLpToken) {
                            baseTokenIds.add(depDependency.tokenA.contractId);
                        }
                        if (!depDependency.tokenB.isLpToken) {
                            baseTokenIds.add(depDependency.tokenB.contractId);
                        }
                    }
                });
                
                // Also add any direct base tokens
                if (!dependency.tokenA.isLpToken) {
                    baseTokenIds.add(dependency.tokenA.contractId);
                }
                if (!dependency.tokenB.isLpToken) {
                    baseTokenIds.add(dependency.tokenB.contractId);
                }
            }
        });
        
        const baseTokenArray = Array.from(baseTokenIds);
        console.log(`Base tokens needed: ${baseTokenArray.length}`);
        
        // Get prices for base tokens
        const priceMap = await getMultipleTokenPrices(baseTokenArray);
        priceMap.forEach((priceData, tokenId) => {
            if (priceData.usdPrice > 0) {
                basePrices[tokenId] = priceData.usdPrice;
            }
        });
        
        console.log(`Base prices obtained: ${Object.keys(basePrices).length}`);
        console.log('Sample base prices:');
        Object.entries(basePrices).slice(0, 5).forEach(([tokenId, price]) => {
            console.log(`  ${tokenId}: $${price.toFixed(6)}`);
        });
        
        // Step 4: Process LP tokens with dependency resolution
        console.log('\n=== STEP 4: PROCESS LP TOKENS WITH DEPENDENCY RESOLUTION ===');
        const processingQueue = await import('@/lib/pricing/lp-processing-queue');
        const lpIntrinsicResults = await processingQueue.calculateAllLpIntrinsicValues(basePrices);
        
        console.log(`\nLP intrinsic calculations completed: ${lpIntrinsicResults.size} tokens`);
        
        // Step 5: Validate Level 1 results
        console.log('\n=== STEP 5: VALIDATE LEVEL 1 RESULTS ===');
        let level1Successfully = 0;
        let level1Failed = 0;
        
        level1Tokens.forEach(contractId => {
            const result = lpIntrinsicResults.get(contractId);
            const dependency = dependencyGraph.getDependency(contractId);
            
            if (result && dependency) {
                level1Successfully++;
                console.log(`\n✅ ${dependency.symbol} (Level ${result.level}):`);
                console.log(`   Intrinsic Value: $${result.usdPrice.toFixed(8)}`);
                console.log(`   sBTC Ratio: ${result.sbtcRatio.toFixed(12)}`);
                console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
                console.log(`   Dependencies satisfied: ${result.dependencies.length}`);
                
                // Verify dependency prices were available
                let allDepsAvailable = true;
                result.dependencies.forEach(depId => {
                    const depResult = lpIntrinsicResults.get(depId);
                    if (depResult) {
                        console.log(`   └─ ${depId}: $${depResult.usdPrice.toFixed(6)} (Level ${depResult.level})`);
                    } else {
                        console.log(`   └─ ${depId}: ❌ Missing`);
                        allDepsAvailable = false;
                    }
                });
                
                if (!allDepsAvailable) {
                    console.log(`   ⚠️  Some dependencies were missing`);
                }
            } else {
                level1Failed++;
                console.log(`\n❌ ${dependency?.symbol || contractId}:`);
                console.log(`   Failed to calculate intrinsic value`);
                console.log(`   Dependency info: ${dependency ? 'Available' : 'Missing'}`);
                console.log(`   Result: ${result ? 'Available' : 'Missing'}`);
            }
        });
        
        // Step 6: Summary
        console.log('\n=== VALIDATION SUMMARY ===');
        console.log(`Level 1 LP tokens found: ${level1Tokens.length}`);
        console.log(`Successfully processed: ${level1Successfully}`);
        console.log(`Failed: ${level1Failed}`);
        console.log(`Success rate: ${level1Tokens.length > 0 ? ((level1Successfully / level1Tokens.length) * 100).toFixed(1) : 0}%`);
        
        // Show processing order validation
        const processingOrder = dependencyGraph.getProcessingOrder();
        const level0Count = dependencyGraph.getTokensAtLevel(0).length;
        const level1Count = dependencyGraph.getTokensAtLevel(1).length;
        
        console.log(`\nProcessing order validation:`);
        console.log(`  Total processing order: ${processingOrder.length} tokens`);
        console.log(`  Level 0 tokens: ${level0Count} (should be processed first)`);
        console.log(`  Level 1 tokens: ${level1Count} (should be processed after Level 0)`);
        
        // Verify processing order
        const level0InOrder = processingOrder.slice(0, level0Count);
        const level1InOrder = processingOrder.slice(level0Count, level0Count + level1Count);
        
        console.log(`  Level 0 order: ${level0InOrder.slice(0, 3).join(', ')}${level0InOrder.length > 3 ? '...' : ''}`);
        console.log(`  Level 1 order: ${level1InOrder.join(', ')}`);
        
        if (level1Successfully === level1Tokens.length) {
            console.log('\n🎉 All Level 1 LP tokens processed successfully!');
        } else {
            console.log('\n⚠️  Some Level 1 LP tokens failed processing');
        }
        
    } catch (error) {
        console.error('❌ Validation failed:', error instanceof Error ? error.message : error);
        console.error('Full error:', error);
        process.exit(1);
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script validate-level1-lp-tokens');
    console.log('\nThis script validates the Level 1 LP token dependency processing system.');
    console.log('It tests tokens like NTEN and DEX-CORGI that depend on other LP tokens.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the script
main().catch(console.error);