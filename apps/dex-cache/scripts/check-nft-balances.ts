// Script to check NFT balances for a specific address using polyglot
import { callReadOnlyFunction } from '@repo/polyglot';
import { principalCV, uintCV } from '@stacks/transactions';

async function checkNFTBalances() {
    console.log('🔍 Checking NFT Balances for Status Effect Bonuses');
    console.log('='.repeat(80));

    // Test address - replace with your actual wallet address
    const testAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'; // Default to contract deployer

    console.log(`📋 Checking NFT balances for: ${testAddress}`);
    console.log('-'.repeat(50));

    // NFT contracts to check based on our research
    const nftContracts = [
        // Welsh NFT Collections
        {
            name: 'Happy Welsh',
            id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.happy-welsh',
            type: 'welsh'
        },
        {
            name: 'Weird Welsh',
            id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.weird-welsh',
            type: 'welsh'
        },
        {
            name: 'Welsh Punk',
            id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-punk',
            type: 'welsh'
        },
        {
            name: 'Legendary Welsh',
            id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.legendary-welsh',
            type: 'welsh'
        },

        // Raven NFT Collections
        {
            name: 'Ravens',
            id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.ravens',
            type: 'raven'
        },
        {
            name: 'Raven',
            id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.raven',
            type: 'raven'
        },

        // Memobot Collections
        {
            name: 'Memobots',
            id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.memobots',
            type: 'memobot'
        },
        {
            name: 'Memobot',
            id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.memobot',
            type: 'memobot'
        },

        // Other potential collections
        {
            name: 'Charismatic Corgi',
            id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-corgi',
            type: 'other'
        }
    ];

    const results: Record<string, any> = {};

    for (const contract of nftContracts) {
        console.log(`\n🔍 Checking ${contract.name} (${contract.id})`);

        try {
            // Try different NFT balance check methods
            const methods = [
                { name: 'get-balance', params: [principalCV(testAddress)] },
                { name: 'get-owner', params: [uintCV(1)] }, // Check owner of token ID 1
                { name: 'get-last-token-id', params: [] },
                { name: 'get-token-count', params: [principalCV(testAddress)] }
            ];

            for (const method of methods) {
                try {
                    console.log(`  🧪 Testing ${method.name}...`);
                    const result = await callReadOnlyFunction(
                        contract.id,
                        method.name,
                        method.params
                    );

                    console.log(`    ✅ ${method.name} result:`, JSON.stringify(result, null, 2));

                    if (!results[contract.id]) {
                        results[contract.id] = {};
                    }
                    results[contract.id][method.name] = result;

                } catch (error) {
                    console.log(`    ❌ ${method.name} failed:`, error.message);
                }
            }

            // If we found a last-token-id, try to check ownership of multiple tokens
            if (results[contract.id]?.['get-last-token-id']) {
                const lastTokenId = results[contract.id]['get-last-token-id'];
                console.log(`  🔍 Found last token ID: ${lastTokenId}, checking ownership...`);

                // Check ownership of first few tokens
                const maxCheck = Math.min(10, parseInt(lastTokenId) || 0);
                let ownedTokens = [];

                for (let tokenId = 1; tokenId <= maxCheck; tokenId++) {
                    try {
                        const owner = await callReadOnlyFunction(
                            contract.id,
                            'get-owner',
                            [uintCV(tokenId)]
                        );

                        if (owner && JSON.stringify(owner).includes(testAddress)) {
                            ownedTokens.push(tokenId);
                            console.log(`    ✅ Owns token ID ${tokenId}`);
                        }
                    } catch (error) {
                        // Token might not exist or other error
                    }
                }

                if (ownedTokens.length > 0) {
                    console.log(`  🎉 OWNED TOKENS: ${ownedTokens.join(', ')}`);
                    results[contract.id].ownedTokens = ownedTokens;
                }
            }

        } catch (error) {
            console.log(`  ❌ Failed to check ${contract.name}:`, error.message);
        }

        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 NFT OWNERSHIP SUMMARY');
    console.log('='.repeat(80));

    const ownedNFTs = {
        welsh: 0,
        raven: 0,
        memobot: 0,
        other: 0
    };

    for (const contract of nftContracts) {
        const contractResults = results[contract.id];
        if (contractResults?.ownedTokens?.length > 0) {
            console.log(`\n✅ ${contract.name}: ${contractResults.ownedTokens.length} NFTs`);
            console.log(`   Token IDs: ${contractResults.ownedTokens.join(', ')}`);
            ownedNFTs[contract.type] += contractResults.ownedTokens.length;
        }
    }

    console.log('\n🎯 BONUS CALCULATION:');
    console.log(`   Welsh NFTs: ${ownedNFTs.welsh} (${ownedNFTs.welsh * 5}% energy generation bonus)`);
    console.log(`   Raven NFTs: ${ownedNFTs.raven} (fee discount bonus)`);
    console.log(`   Memobot NFTs: ${ownedNFTs.memobot} (+${ownedNFTs.memobot * 50} energy capacity)`);
    console.log(`   Other NFTs: ${ownedNFTs.other}`);

    return results;
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