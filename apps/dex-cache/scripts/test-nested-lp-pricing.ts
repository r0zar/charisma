#!/usr/bin/env tsx

/**
 * Test nested LP token intrinsic pricing specifically for dependency resolution
 * Focus on Level 1 tokens: NTEN, DEX-CORGI, LOST, CD
 * Usage: pnpm script test-nested-lp-pricing
 */

async function main() {
    console.log('🧪 Testing nested LP token pricing...\n');
    
    try {
        console.log('=== STEP 1: IMPORT MODULES ===');
        console.log('Importing dependency graph...');
        const { getLpDependencyGraph } = await import('@/lib/pricing/lp-dependency-graph');
        
        console.log('Importing processing queue...');
        const { calculateAllLpIntrinsicValues } = await import('@/lib/pricing/lp-processing-queue');
        
        console.log('✅ All modules imported successfully\n');
        
        console.log('=== STEP 2: BUILD DEPENDENCY GRAPH ===');
        const dependencyGraph = await getLpDependencyGraph();
        const stats = dependencyGraph.getStats();
        
        console.log(`📊 Dependency Graph Stats:`);
        console.log(`   Total LP tokens: ${stats.totalLpTokens}`);
        console.log(`   Levels: ${stats.levelCount}`);
        console.log(`   Level distribution: ${JSON.stringify(stats.levelDistribution)}`);
        
        const level1Tokens = dependencyGraph.getTokensAtLevel(1);
        console.log(`\n🎯 Level 1 tokens (${level1Tokens.length}):`);
        level1Tokens.forEach(contractId => {
            const dep = dependencyGraph.getDependency(contractId);
            console.log(`   ${dep?.symbol || 'Unknown'} (${contractId})`);
        });
        
        if (level1Tokens.length === 0) {
            console.log('⚠️  No Level 1 tokens found. System may be working correctly with only Level 0 tokens.');
            return;
        }
        
        console.log('\n=== STEP 3: CREATE MOCK BASE PRICES ===');
        // Create a simple set of base prices for testing
        const basePrices: Record<string, number> = {
            // STX
            '.stx': 2.50,
            // sBTC
            'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token': 100000,
            // Major tokens likely to be in dependencies
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token': 0.012,
            'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token': 0.08,
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl': 0.000045,
            'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token': 0.000000234
        };
        
        console.log(`📦 Created ${Object.keys(basePrices).length} mock base prices`);
        Object.entries(basePrices).forEach(([token, price]) => {
            const symbol = token.split('.').pop() || token;
            console.log(`   ${symbol}: $${price}`);
        });
        
        console.log('\n=== STEP 4: PROCESS LP TOKENS ===');
        console.log('🔄 Processing all LP tokens with dependency resolution...');
        
        const startTime = Date.now();
        const lpResults = await calculateAllLpIntrinsicValues(basePrices);
        const processingTime = Date.now() - startTime;
        
        console.log(`✅ Processing completed in ${processingTime}ms`);
        console.log(`📈 Results: ${lpResults.size} LP tokens calculated\n`);
        
        console.log('=== STEP 5: ANALYZE LEVEL 1 RESULTS ===');
        let level1Found = 0;
        let level1Success = 0;
        
        level1Tokens.forEach(contractId => {
            const result = lpResults.get(contractId);
            const dep = dependencyGraph.getDependency(contractId);
            
            if (dep) {
                level1Found++;
                console.log(`\n🔍 ${dep.symbol} (${contractId}):`);
                console.log(`   Level: ${dep.level}`);
                console.log(`   Dependencies: ${dep.dependencies.length}`);
                dep.dependencies.forEach(depId => {
                    const depDep = dependencyGraph.getDependency(depId);
                    const depResult = lpResults.get(depId);
                    console.log(`     └─ ${depDep?.symbol || depId}: ${depResult ? `$${depResult.usdPrice.toFixed(8)}` : '❌ Missing'}`);
                });
                
                if (result) {
                    level1Success++;
                    console.log(`   ✅ Intrinsic Value: $${result.usdPrice.toFixed(8)}`);
                    console.log(`   📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
                    console.log(`   🎯 sBTC Ratio: ${result.sbtcRatio.toFixed(12)}`);
                } else {
                    console.log(`   ❌ Failed to calculate intrinsic value`);
                }
            }
        });
        
        console.log('\n=== RESULTS SUMMARY ===');
        console.log(`🎯 Level 1 tokens found: ${level1Found}`);
        console.log(`✅ Successfully processed: ${level1Success}`);
        console.log(`❌ Failed: ${level1Found - level1Success}`);
        console.log(`📊 Success rate: ${level1Found > 0 ? ((level1Success / level1Found) * 100).toFixed(1) : 0}%`);
        
        // Show all results by level
        console.log('\n=== ALL RESULTS BY LEVEL ===');
        const levels = dependencyGraph.getLevels().sort((a, b) => a - b);
        
        levels.forEach(level => {
            const tokensAtLevel = dependencyGraph.getTokensAtLevel(level);
            const successCount = tokensAtLevel.filter(id => lpResults.has(id)).length;
            console.log(`Level ${level}: ${successCount}/${tokensAtLevel.length} tokens calculated`);
            
            if (level <= 1) { // Only show details for levels 0 and 1
                tokensAtLevel.slice(0, 3).forEach(contractId => {
                    const dep = dependencyGraph.getDependency(contractId);
                    const result = lpResults.get(contractId);
                    const status = result ? `$${result.usdPrice.toFixed(6)}` : '❌';
                    console.log(`   ${dep?.symbol || 'Unknown'}: ${status}`);
                });
                if (tokensAtLevel.length > 3) {
                    console.log(`   ... and ${tokensAtLevel.length - 3} more`);
                }
            }
        });
        
        if (level1Success === level1Found && level1Found > 0) {
            console.log('\n🎉 SUCCESS: All Level 1 LP tokens processed correctly!');
            console.log('✅ Dependency resolution is working as expected');
        } else if (level1Found === 0) {
            console.log('\n✅ INFO: No Level 1 tokens detected - system working with Level 0 only');
        } else {
            console.log('\n⚠️  PARTIAL SUCCESS: Some Level 1 tokens failed processing');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error instanceof Error ? error.message : error);
        console.error('Full error:', error);
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);