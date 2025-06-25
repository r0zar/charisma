// Test token metadata enrichment using getTokenMetadataCached
import { getTokenMetadataCached } from '@repo/tokens';

interface TokenToTest {
    contractId: string;
    name: string;
    purpose: string;
}

async function testTokenMetadataEnrichment() {
    console.log('🧪 Testing Token Metadata Enrichment');
    console.log('');

    const tokensToTest: TokenToTest[] = [
        {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1',
            name: 'Dexterity Pool V1',
            purpose: 'Required token for energy generation'
        },
        {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy',
            name: 'Energy Token',
            purpose: 'Energy reward token'
        },
        {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
            name: 'Charisma Token',
            purpose: 'Base governance token'
        }
    ];

    console.log('🔍 Testing metadata fetching for energy-related tokens...');
    console.log('');

    for (const tokenInfo of tokensToTest) {
        console.log(`📋 Testing: ${tokenInfo.name}`);
        console.log(`   Contract: ${tokenInfo.contractId}`);
        console.log(`   Purpose: ${tokenInfo.purpose}`);
        
        try {
            const metadata = await getTokenMetadataCached(tokenInfo.contractId);
            
            if (metadata) {
                console.log('   ✅ Metadata found:');
                console.log(`      Name: ${metadata.name}`);
                console.log(`      Symbol: ${metadata.symbol}`);
                console.log(`      Decimals: ${metadata.decimals}`);
                console.log(`      Total Supply: ${metadata.total_supply}`);
                console.log(`      Image: ${metadata.image ? 'Present' : 'Missing'}`);
                console.log(`      Description: ${metadata.description ? 'Present' : 'Missing'}`);
                
                // Test formatting with decimals
                if (metadata.decimals) {
                    const sampleAmount = 1000000; // Raw amount
                    const formattedAmount = sampleAmount / Math.pow(10, metadata.decimals);
                    console.log(`      Sample formatting: ${sampleAmount} raw = ${formattedAmount} ${metadata.symbol}`);
                }
            } else {
                console.log('   ❌ No metadata found');
            }
        } catch (error) {
            console.log(`   ❌ Error fetching metadata: ${error}`);
        }
        
        console.log('');
    }

    // Test energy-specific calculations
    console.log('⚡ Testing energy-specific calculations...');
    try {
        const [dexPoolMeta, energyMeta] = await Promise.all([
            getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1'),
            getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy')
        ]);

        if (dexPoolMeta && energyMeta) {
            console.log('✅ Both tokens found, testing calculations:');
            
            // Mock calculation
            const userTokenAmount = 1000; // User holds 1000 DEX-POOL-V1 tokens
            const rawUserAmount = userTokenAmount * Math.pow(10, dexPoolMeta.decimals || 6);
            const mockEnergyPerSecond = rawUserAmount * 0.001; // Mock rate
            const formattedEnergyPerSecond = mockEnergyPerSecond / Math.pow(10, energyMeta.decimals || 6);
            
            console.log(`   User holds: ${userTokenAmount} ${dexPoolMeta.symbol}`);
            console.log(`   Raw amount: ${rawUserAmount}`);
            console.log(`   Energy/second (raw): ${mockEnergyPerSecond}`);
            console.log(`   Energy/second (formatted): ${formattedEnergyPerSecond} ${energyMeta.symbol}/sec`);
            console.log(`   Energy/day: ${(formattedEnergyPerSecond * 86400).toLocaleString()} ${energyMeta.symbol}`);
        }
    } catch (error) {
        console.log(`❌ Error in energy calculations: ${error}`);
    }

    console.log('');
    console.log('✨ Token metadata enrichment test complete!');
}

// Run the test
testTokenMetadataEnrichment().catch(console.error);