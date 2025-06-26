#!/usr/bin/env tsx

import { getAllVaultData } from '../src/lib/pool-service';
import { fetchMetadata } from '@repo/tokens';

// List of contract IDs we just synced
const SYNCED_CONTRACTS = [
    'SP1KMAA7TPZ5AZZ4W67X74MJNFKMN576604CWNBQS.dmghoot-lp-token',
    'SP1KMAA7TPZ5AZZ4W67X74MJNFKMN576604CWNBQS.stxshark',
    'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.night-owl',
    'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.nocturnal-tendencies',
    'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.old-faithful',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anonymous-welsh-cvlt',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.bitgear-genesis-fund',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.black-hole-investments',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-corgi-liquidity',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-flow',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dex-corgi-lp-v1',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.gamakichi',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.leo-unchained-lp',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.ornithoptor',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.owlbear-form',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.perseverantia-omnia-vincit',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.president-pepe-lp',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.satoshis-private-key',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stone-mask',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-hoot-lp-token',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.techno-anarchism',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.the-lost-lands',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.the-sneaky-link',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-community-lp',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-susdh-amm-lp-v1',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.whats-up-dog',
    'SP3T1M18J3VX038KSYPP5G450WVWWG9F9G6GAZA4Q.mecha-meme',
    'SP3XXMS38VTAWTVPE5682XSBFXPTH7XCPEBTX8AN2.usda-faktory-pool',
    'SPGYCP878RYFVT03ZT8TWGPKNYTSQB1578VVXHGE.compact-disc',
    'SPGYCP878RYFVT03ZT8TWGPKNYTSQB1578VVXHGE.upgraded-shark'
];

function isPlaceholderImage(imageUrl: string): boolean {
    if (!imageUrl || imageUrl === 'N/A') return true;
    
    const placeholderPatterns = [
        'ui-avatars.com/api/',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAACNJREFUGFdj',
    ];
    
    return placeholderPatterns.some(pattern => imageUrl.includes(pattern)) ||
           (imageUrl.startsWith('data:image/') && imageUrl.length < 200);
}

async function validateLpSync() {
    console.log('🔍 Validating LP token image sync results...\n');

    try {
        // Get LP tokens from dex-cache
        const lpTokens = await getAllVaultData({ protocol: 'CHARISMA', type: 'POOL' });
        console.log(`Found ${lpTokens.length} LP tokens from dex-cache`);

        // Get metadata from token cache
        const allMetadata = await fetchMetadata();
        console.log(`Found ${allMetadata.length} tokens in metadata cache\n`);

        // Create a map of metadata by contractId
        const metadataMap = new Map();
        allMetadata.forEach(token => {
            if (token.contractId) {
                metadataMap.set(token.contractId, token);
            }
        });

        console.log('VALIDATION RESULTS:');
        console.log('═'.repeat(120));

        let successCount = 0;
        let failureCount = 0;
        let partialCount = 0;

        for (const contractId of SYNCED_CONTRACTS) {
            const lpToken = lpTokens.find(t => t.contractId === contractId);
            const metadataToken = metadataMap.get(contractId);
            
            console.log(`\n📋 ${contractId}`);
            
            if (!lpToken) {
                console.log(`   ❌ Not found in LP token data`);
                failureCount++;
                continue;
            }
            
            if (!metadataToken) {
                console.log(`   ❌ Not found in metadata cache`);
                failureCount++;
                continue;
            }

            const lpImage = lpToken.image || 'N/A';
            const metadataImage = metadataToken.image || 'N/A';
            
            console.log(`   LP Image:       ${lpImage}`);
            console.log(`   Metadata Image: ${metadataImage}`);
            
            if (lpImage === metadataImage) {
                if (isPlaceholderImage(lpImage)) {
                    console.log(`   ⚠️  Images match but both are placeholders`);
                    partialCount++;
                } else {
                    console.log(`   ✅ Images match and are real images`);
                    successCount++;
                }
            } else {
                console.log(`   ❌ Images do not match`);
                failureCount++;
            }
        }

        console.log('\n' + '═'.repeat(120));
        console.log('VALIDATION SUMMARY');
        console.log('═'.repeat(120));
        console.log(`✅ Successfully synced: ${successCount}`);
        console.log(`⚠️  Placeholder images: ${partialCount}`);
        console.log(`❌ Failed/mismatched: ${failureCount}`);
        console.log(`📊 Total validated: ${SYNCED_CONTRACTS.length}`);
        
        const successRate = Math.round((successCount / SYNCED_CONTRACTS.length) * 100);
        console.log(`📈 Success rate: ${successRate}%`);

        if (successCount > 25) {
            console.log('\n🎉 VALIDATION PASSED! Most LP token images were successfully synced to metadata cache.');
        } else if (successCount > 15) {
            console.log('\n⚠️  PARTIAL SUCCESS: Some LP token images were synced, but there may be issues.');
        } else {
            console.log('\n❌ VALIDATION FAILED: Most LP token images were not properly synced.');
        }

        // Show some successful examples
        if (successCount > 0) {
            console.log('\n🌟 EXAMPLES OF SUCCESSFUL SYNCS:');
            console.log('─'.repeat(80));
            let exampleCount = 0;
            for (const contractId of SYNCED_CONTRACTS) {
                if (exampleCount >= 5) break;
                
                const lpToken = lpTokens.find(t => t.contractId === contractId);
                const metadataToken = metadataMap.get(contractId);
                
                if (lpToken && metadataToken && 
                    lpToken.image === metadataToken.image && 
                    !isPlaceholderImage(lpToken.image)) {
                    console.log(`✅ ${lpToken.symbol || 'LP'} - ${metadataToken.image}`);
                    exampleCount++;
                }
            }
        }

    } catch (error) {
        console.error('Error validating LP sync:', error);
        process.exit(1);
    }
}

// Run the validation
validateLpSync();