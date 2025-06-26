#!/usr/bin/env tsx

/**
 * Debug which LP tokens exist as nodes in the price graph
 * Usage: pnpm script debug-price-graph-nodes
 */

import { listVaults } from '../src/lib/pool-service';
import { getPriceGraph } from '../src/lib/pricing/price-graph';

async function debugPriceGraphNodes() {
    console.log('🔍 Debugging LP tokens in price graph nodes...');

    try {
        const vaults = await listVaults();
        const graph = await getPriceGraph();
        
        console.log(`\nTotal vaults: ${vaults.length}`);
        
        // Check which vault contracts are also nodes in the price graph
        let lpNodesFound = 0;
        let lpNodesNotFound = 0;
        
        console.log('\n🔍 Checking which LP tokens exist as nodes in price graph:');
        
        for (const vault of vaults.slice(0, 10)) { // Check first 10 for brevity
            const tokenNode = graph.getNode(vault.contractId);
            if (tokenNode) {
                console.log(`✅ ${vault.symbol} (${vault.contractId})`);
                console.log(`   Node symbol: ${tokenNode.symbol}, usdPrice: ${tokenNode.usdPrice || 'N/A'}`);
                lpNodesFound++;
            } else {
                console.log(`❌ ${vault.symbol} (${vault.contractId}) - NOT FOUND AS NODE`);
                lpNodesNotFound++;
            }
        }
        
        console.log(`\nSummary (first 10 LP tokens):`);
        console.log(`  Found as nodes: ${lpNodesFound}`);
        console.log(`  Not found as nodes: ${lpNodesNotFound}`);
        
        // List all nodes in the graph
        const allTokens = graph.getAllTokens();
        console.log(`\nTotal nodes in price graph: ${allTokens.length}`);
        
        // Check which nodes are LP tokens (by matching against vault list)
        const vaultIds = new Set(vaults.map(v => v.contractId));
        const lpTokenNodes = allTokens.filter(token => vaultIds.has(token.contractId));
        
        console.log(`LP tokens that exist as nodes: ${lpTokenNodes.length}`);
        
        if (lpTokenNodes.length > 0) {
            console.log('\n🎯 LP tokens found as graph nodes:');
            lpTokenNodes.slice(0, 5).forEach(node => {
                const vault = vaults.find(v => v.contractId === node.contractId);
                console.log(`  ${vault?.symbol || node.symbol} (${node.contractId})`);
                console.log(`    USD Price: ${node.usdPrice || 'N/A'}`);
                console.log(`    Total Liquidity: ${node.totalLiquidity || 'N/A'}`);
            });
        }
        
        // Check a specific working example
        const workingExample = 'SP15WAVKQNT241YVCGQMJS777E17H9TS96M21Q5DX.sexy-pepe';
        const workingNode = graph.getNode(workingExample);
        
        console.log(`\n🔬 Detailed check of working example (${workingExample}):`);
        if (workingNode) {
            console.log(`✅ Found as node:`);
            console.log(`  Symbol: ${workingNode.symbol}`);
            console.log(`  USD Price: ${workingNode.usdPrice}`);
            console.log(`  Total Liquidity: ${workingNode.totalLiquidity}`);
            console.log(`  Decimals: ${workingNode.decimals}`);
        } else {
            console.log(`❌ NOT found as node (but should be working)`);
        }

    } catch (error) {
        console.error('❌ Debug failed:', error);
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script debug-price-graph-nodes');
    console.log('\nDescription:');
    console.log('  Checks which LP tokens exist as tradeable nodes in the price graph');
    console.log('  vs only existing as pools. This helps debug why some LP tokens');
    console.log('  can be priced while others cannot.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

debugPriceGraphNodes().catch(console.error);