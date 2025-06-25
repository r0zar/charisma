// Basic script to test getAccountBalances from polyglot
import { getAccountBalances, callReadOnly } from '@repo/polyglot';

async function testAccountBalances() {
    console.log('🔍 Testing getAccountBalances from polyglot');
    console.log('='.repeat(60));

    // Test address - your wallet address
    const testAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
    
    console.log(`📋 Getting account balances for: ${testAddress}`);
    console.log('-'.repeat(40));

    try {
        const balances = await getAccountBalances(testAddress);
        
        if (!balances) {
            console.log('❌ No balances returned');
            return;
        }
        
        console.log('✅ Account balances retrieved!');
        
        // Check STX balance
        if (balances.stx) {
            console.log(`\n💰 STX Balance: ${balances.stx.balance} μSTX`);
        }
        
        // Check fungible tokens
        if (balances.fungible_tokens) {
            console.log(`\n🪙 Fungible Tokens: ${Object.keys(balances.fungible_tokens).length} types`);
            Object.entries(balances.fungible_tokens).slice(0, 5).forEach(([token, info]) => {
                console.log(`  ${token}: ${info.balance}`);
            });
        }
        
        // Check NFTs - this is what we're most interested in!
        if (balances.non_fungible_tokens) {
            console.log(`\n🖼️  NFT Collections: ${Object.keys(balances.non_fungible_tokens).length} types`);
            
            // Look for Welsh, Raven, and Memobot NFTs specifically
            const nftEntries = Object.entries(balances.non_fungible_tokens);
            const relevantNFTs = nftEntries.filter(([contractId, data]) => {
                return contractId.includes('welsh') || 
                       contractId.includes('raven') || 
                       contractId.includes('memobot') ||
                       contractId.includes('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS');
            });
            
            if (relevantNFTs.length > 0) {
                console.log(`\n🎯 Found ${relevantNFTs.length} relevant NFT collections:`);
                relevantNFTs.forEach(([contractId, data]) => {
                    console.log(`  ✅ ${contractId}:`);
                    console.log(`     Count: ${data.count}`);
                    console.log(`     Total received: ${data.total_received}`);
                    console.log(`     Total sent: ${data.total_sent}`);
                });
            } else {
                console.log('❌ No Welsh/Raven/Memobot NFTs found');
            }
            
            // Show all NFT collections for debugging
            console.log(`\n📋 All NFT collections (first 10):`);
            nftEntries.slice(0, 10).forEach(([contractId, data]) => {
                console.log(`  ${contractId}: ${data.count} NFTs`);
            });
        }
        
        return balances;
        
    } catch (error) {
        console.error('❌ Error getting account balances:', error);
        
        // Try alternative approach with a simple contract call
        console.log('\n🔄 Trying alternative method with callReadOnly...');
        try {
            const result = await callReadOnly(
                'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy',
                'get-balance',
                []
            );
            console.log('✅ Alternative call result:', result);
        } catch (altError) {
            console.error('❌ Alternative method also failed:', altError.message);
        }
        
        process.exit(1);
    }
}

// Run the test
testAccountBalances().catch(console.error);