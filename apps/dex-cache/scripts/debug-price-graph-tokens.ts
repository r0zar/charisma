#!/usr/bin/env tsx

/**
 * Debug price graph token mapping issue
 * Usage: pnpm script debug-price-graph-tokens
 */

import { getPriceGraph } from '@/lib/pricing/price-graph';
import { SBTC_CONTRACT_ID } from '@/lib/pricing/btc-oracle';

async function main() {
    console.log('🔍 Debugging price graph token mapping...\n');
    
    try {
        // Get the price graph
        console.log('Building price graph...');
        const graph = await getPriceGraph();
        
        // Get all tokens
        const allTokens = graph.getAllTokens();
        console.log(`\n📊 Found ${allTokens.length} tokens from getAllTokens():\n`);
        
        allTokens.forEach((token, i) => {
            console.log(`Token ${i + 1}:`);
            console.log(`  Contract ID: ${token.contractId}`);
            console.log(`  Symbol: ${token.symbol}`);
            console.log(`  USD Price: ${token.usdPrice ? `$${token.usdPrice.toFixed(6)}` : 'null'}`);
            console.log(`  Price exists: ${!!(token.usdPrice && token.usdPrice > 0)}`);
            console.log('');
        });
        
        // Test the mapping process
        console.log('🔧 Testing price mapping process:');
        const currentPrices: Record<string, number> = {};
        
        // Add sBTC anchor
        currentPrices[SBTC_CONTRACT_ID] = 107499.2; // Mock BTC price
        
        // Add tokens from graph
        allTokens.forEach(token => {
            if (token.usdPrice && token.usdPrice > 0) {
                currentPrices[token.contractId] = token.usdPrice;
                console.log(`✅ Added ${token.symbol} (${token.contractId}): $${token.usdPrice.toFixed(6)}`);
            } else {
                console.log(`❌ Skipped ${token.symbol} (${token.contractId}): price=${token.usdPrice}`);
            }
        });
        
        console.log(`\n💰 Final currentPrices map has ${Object.keys(currentPrices).length} entries:`);
        Object.entries(currentPrices).forEach(([contractId, price]) => {
            console.log(`  ${contractId}: $${price.toFixed(6)}`);
        });
        
        // Test specific tokens we need
        console.log('\n🎯 Checking specific tokens we need for LP calculation:');
        const neededTokens = [
            '.stx',
            'SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.tokensoft-token-v4k68639zxz',
            'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl',
            'SP1KMAA7TPZ5AZZ4W67X74MJNFKMN576604CWNBQS.shark-coin-stxcity'
        ];
        
        neededTokens.forEach(tokenId => {
            const price = currentPrices[tokenId];
            const token = allTokens.find(t => t.contractId === tokenId);
            console.log(`  ${tokenId}:`);
            console.log(`    Found in graph: ${!!token}`);
            if (token) {
                console.log(`    Symbol: ${token.symbol}`);
                console.log(`    USD Price: ${token.usdPrice}`);
            }
            console.log(`    In currentPrices: ${price ? `$${price.toFixed(6)}` : 'NO'}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        console.error('Full error:', error);
    }
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: pnpm script debug-price-graph-tokens');
    console.log('\nDebugs price graph token mapping for LP intrinsic calculations');
    process.exit(0);
}

// Run the script
main().catch(console.error);