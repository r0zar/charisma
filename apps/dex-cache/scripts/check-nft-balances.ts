// Script to check NFT balances for a specific address using polyglot
import { callReadOnlyFunction, getAccountBalances } from '@repo/polyglot';
import { principalCV, uintCV } from '@stacks/transactions';

async function checkNFTBalances() {
    console.log('🔍 Checking NFT Collections');
    console.log('='.repeat(80));

    // Test address - replace with your actual wallet address
    const testAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'; // Default to contract deployer

    try {
        const accountData = await getAccountBalances(testAddress);
        
        console.log(`📋 Checking NFT balances for: ${testAddress}`);
        console.log('-'.repeat(60));
        
        if (accountData?.non_fungible_tokens) {
            const nftEntries = Object.entries(accountData.non_fungible_tokens);
            console.log(`🖼️  Found ${nftEntries.length} NFT collections in account`);
            console.log('='.repeat(60));
            
            // Show only collections with NFTs owned
            const ownedCollections = nftEntries.filter(([_, nftData]) => parseInt(nftData.count) > 0);
            
            if (ownedCollections.length > 0) {
                console.log(`\n✅ OWNED NFT COLLECTIONS (${ownedCollections.length} collections):`);
                console.log('-'.repeat(50));
                
                for (const [contractId, nftData] of ownedCollections) {
                    const count = parseInt(nftData.count);
                    const name = contractId.split('::')[1] || contractId.split('.').pop();
                    
                    console.log(`📦 ${name}`);
                    console.log(`   Contract: ${contractId}`);
                    console.log(`   Count: ${count} NFTs`);
                    console.log(`   Received: ${nftData.total_received}`);
                    console.log(`   Sent: ${nftData.total_sent}`);
                    console.log('');
                }
                
                // Show summary by categories
                console.log('\n🎯 CATEGORY SUMMARY:');
                console.log('-'.repeat(40));
                
                const welsh = ownedCollections.filter(([id]) => id.toLowerCase().includes('welsh'));
                const ravens = ownedCollections.filter(([id]) => id.toLowerCase().includes('raven'));
                const memobots = ownedCollections.filter(([id]) => id.toLowerCase().includes('memobot'));
                
                console.log(`🏴󠁧󠁢󠁷󠁬󠁳󠁿 Welsh NFTs: ${welsh.length} collections, ${welsh.reduce((sum, [_, data]) => sum + parseInt(data.count), 0)} total NFTs`);
                console.log(`🐦 Raven NFTs: ${ravens.length} collections, ${ravens.reduce((sum, [_, data]) => sum + parseInt(data.count), 0)} total NFTs`);
                console.log(`🤖 Memobot NFTs: ${memobots.length} collections, ${memobots.reduce((sum, [_, data]) => sum + parseInt(data.count), 0)} total NFTs`);
                console.log(`📦 Other NFTs: ${ownedCollections.length - welsh.length - ravens.length - memobots.length} collections`);
                
            } else {
                console.log('❌ No NFTs owned in any collection');
            }
            
        } else {
            console.log('❌ No NFT data found in account balances');
        }
        
    } catch (error) {
        console.error('❌ Error getting NFT collections:', error);
    }
}

// Parse command line arguments for custom address
const args = process.argv.slice(2);
const customAddress = args[0];

if (customAddress) {
    console.log(`Using custom address: ${customAddress}`);
    // You could modify the testAddress variable here if needed
}

// Run the check
checkNFTBalances().catch(console.error);