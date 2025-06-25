#!/usr/bin/env tsx
// Script to copy images from existing tokens to missing tokens in the metadata service

interface TokenMapping {
    missingToken: {
        contractId: string;
        name: string;
        symbol: string;
    };
    sourceToken: {
        contractId: string;
        name: string;
        symbol: string;
        imageUrl: string;
    };
    confidence: 'high' | 'medium';
    reason: string;
}

// Mappings based on the similarity analysis - only high confidence matches
const TOKEN_MAPPINGS: TokenMapping[] = [
    {
        missingToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl',
            name: 'Anime Demon Girl',
            symbol: 'ADG'
        },
        sourceToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl-dexterity',
            name: 'Anime Demon Girl',
            symbol: 'THICC',
            imageUrl: 'https://charisma.rocks/sip10/chyat/logo.png'
        },
        confidence: 'high',
        reason: '100% name match - same token, different implementation'
    },
    {
        missingToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
            name: 'Charisma Token',
            symbol: 'CHA'
        },
        sourceToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
            name: 'Charisma',
            symbol: 'CHA',
            imageUrl: 'https://charisma.rocks/charisma-logo-square.png'
        },
        confidence: 'high',
        reason: '100% symbol match - official Charisma token image'
    },
    {
        missingToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-energy',
            name: 'Charisma Energy',
            symbol: 'ENERGY'
        },
        sourceToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy',
            name: 'Energy',
            symbol: 'ENERGY',
            imageUrl: 'https://charisma.rocks/sip10/energy/logo.png'
        },
        confidence: 'high',
        reason: 'Exact match for Energy token'
    },
    {
        missingToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.liquid-staked-charisma',
            name: 'Liquid Staked Charisma',
            symbol: 'LSCHA'
        },
        sourceToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.liquid-staked-charisma',
            name: 'Liquid Staked Charisma',
            symbol: 'liquid-staked-charisma',
            imageUrl: 'https://charisma.rocks/liquid-staked-charisma.png'
        },
        confidence: 'high',
        reason: '100% name match - exact same token'
    },
    {
        missingToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.up-dog',
            name: 'Up Dog',
            symbol: 'UP'
        },
        sourceToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.up-dog',
            name: 'Up Dog',
            symbol: 'UPDOG',
            imageUrl: 'https://charisma.rocks/sip10/up-dog/logo.gif'
        },
        confidence: 'high',
        reason: '100% name match - exact same token'
    },
    {
        missingToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-coin',
            name: 'Welsh Coin',
            symbol: 'WELSH'
        },
        sourceToken: {
            contractId: 'SP1J6G7AMAA8W681977M6P8C7JQDNMZMVNHWSK40X.welshcorgicoin-token',
            name: 'Welshcorgicoin',
            symbol: 'WELSH',
            imageUrl: 'https://charisma.rocks/sip10/welsh/logo.png'
        },
        confidence: 'high',
        reason: '100% symbol match - Welsh corgi coin'
    },
    {
        missingToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.iou-welsh',
            name: 'IOU Welsh',
            symbol: 'WELSH'
        },
        sourceToken: {
            contractId: 'SP1J6G7AMAA8W681977M6P8C7JQDNMZMVNHWSK40X.welshcorgicoin-token',
            name: 'Welshcorgicoin',
            symbol: 'WELSH',
            imageUrl: 'https://charisma.rocks/sip10/welsh/logo.png'
        },
        confidence: 'high',
        reason: '100% symbol match - IOU version of Welsh coin'
    },
    {
        missingToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.roo-coin',
            name: 'Roo Coin',
            symbol: 'ROO'
        },
        sourceToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.roo',
            name: '$ROO',
            symbol: '$ROO',
            imageUrl: 'https://charisma.rocks/sip10/roo/logo.png'
        },
        confidence: 'high',
        reason: '100% symbol match - ROO token'
    },
    {
        missingToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.wrapped-bitcoin',
            name: 'Wrapped Bitcoin',
            symbol: 'xBTC'
        },
        sourceToken: {
            contractId: 'SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR.Wrapped-Bitcoin',
            name: 'Wrapped Bitcoin',
            symbol: 'xBTC',
            imageUrl: 'https://token-images.alexlab.co/token-wbtc'
        },
        confidence: 'high',
        reason: '100% name and symbol match - Wrapped Bitcoin'
    },
    {
        missingToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dungeon-master',
            name: 'Dungeon Master',
            symbol: 'DM'
        },
        sourceToken: {
            contractId: 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token',
            name: 'Charisma Governance',
            symbol: 'DMG',
            imageUrl: 'https://charisma.rocks/dmg-logo.gif'
        },
        confidence: 'medium',
        reason: 'DMG is the governance token for Dungeon Master system'
    },
    {
        missingToken: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.bitcoin-pizza',
            name: 'Bitcoin Pizza',
            symbol: 'PIZZA'
        },
        sourceToken: {
            contractId: 'SP256VGYK7ZFV6S2ZWHGE4PGMDDY8KWT3FD57H98G.pizza',
            name: 'PIZZA',
            symbol: 'PIZZA',
            imageUrl: 'https://pdakhjpwkuwtadzmpnjm.supabase.co/storage/v1/object/public/token_logo/hKOOpRdX-pngegg.png'
        },
        confidence: 'high',
        reason: '100% symbol match - Pizza token'
    }
];

interface UpdateResult {
    contractId: string;
    success: boolean;
    error?: string;
    imageUrl?: string;
}

async function updateTokenMetadata(contractId: string, imageUrl: string): Promise<UpdateResult> {
    try {
        console.log(`  Updating ${contractId} with image: ${imageUrl}`);
        
        // Import KV here to avoid module issues
        const { kv } = await import('@vercel/kv');
        
        // Check both metadata: and sip10: prefixes for existing metadata
        const metadataKey = `metadata:${contractId}`;
        const legacyKey = `sip10:${contractId}`;
        
        let existingMetadata = await kv.get(metadataKey);
        let keyToUpdate = metadataKey;
        
        if (!existingMetadata) {
            existingMetadata = await kv.get(legacyKey);
            keyToUpdate = legacyKey;
        }
        
        // If no existing metadata, create minimal metadata with just the image
        if (!existingMetadata) {
            existingMetadata = {
                contractId,
                lastUpdated: Date.now().toString()
            };
            keyToUpdate = metadataKey; // Use new format for new entries
        }
        
        // Update only the image field, preserving all other metadata
        const updatedMetadata = {
            ...existingMetadata,
            image: imageUrl,
            lastUpdated: Date.now().toString()
        };
        
        // Store the updated metadata
        await kv.set(keyToUpdate, updatedMetadata);
        
        console.log(`  ✅ Updated ${keyToUpdate} in KV store`);
        
        return {
            contractId,
            success: true,
            imageUrl
        };
        
    } catch (error: any) {
        return {
            contractId,
            success: false,
            error: error.message
        };
    }
}

async function copyTokenImages(dryRun: boolean = true): Promise<void> {
    console.log('🖼️  COPYING TOKEN IMAGES');
    console.log(`Mode: ${dryRun ? 'DRY RUN (simulation)' : 'LIVE (will update metadata service)'}`);
    console.log('');
    
    console.log('📋 PLANNED UPDATES:');
    console.log('─'.repeat(80));
    
    TOKEN_MAPPINGS.forEach((mapping, index) => {
        const confidenceIcon = mapping.confidence === 'high' ? '✅' : '⚠️';
        console.log(`${index + 1}. ${confidenceIcon} ${mapping.missingToken.name} (${mapping.missingToken.symbol})`);
        console.log(`   Missing: ${mapping.missingToken.contractId}`);
        console.log(`   Source: ${mapping.sourceToken.name} (${mapping.sourceToken.symbol})`);
        console.log(`   Image: ${mapping.sourceToken.imageUrl}`);
        console.log(`   Reason: ${mapping.reason}`);
        console.log('');
    });
    
    console.log(`Total updates planned: ${TOKEN_MAPPINGS.length}`);
    console.log('');
    
    if (dryRun) {
        console.log('🔄 DRY RUN MODE - No actual updates will be made');
        console.log('To execute these updates, run: pnpm script copy-token-images live');
        return;
    }
    
    console.log('🚀 EXECUTING UPDATES...');
    console.log('');
    
    const results: UpdateResult[] = [];
    
    for (const mapping of TOKEN_MAPPINGS) {
        console.log(`📸 Processing ${mapping.missingToken.name}...`);
        
        const result = await updateTokenMetadata(
            mapping.missingToken.contractId,
            mapping.sourceToken.imageUrl
        );
        
        results.push(result);
        
        if (result.success) {
            console.log(`  ✅ Successfully updated!`);
        } else {
            console.log(`  ❌ Failed: ${result.error}`);
        }
        
        // Small delay between requests to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('');
    console.log('📊 UPDATE RESULTS');
    console.log('═'.repeat(80));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`Total updates attempted: ${results.length}`);
    console.log(`Successful updates: ${successful.length}`);
    console.log(`Failed updates: ${failed.length}`);
    console.log('');
    
    if (successful.length > 0) {
        console.log('✅ SUCCESSFUL UPDATES:');
        console.log('─'.repeat(40));
        successful.forEach(result => {
            const mapping = TOKEN_MAPPINGS.find(m => m.missingToken.contractId === result.contractId);
            console.log(`• ${mapping?.missingToken.name} (${mapping?.missingToken.symbol})`);
        });
        console.log('');
    }
    
    if (failed.length > 0) {
        console.log('❌ FAILED UPDATES:');
        console.log('─'.repeat(40));
        failed.forEach(result => {
            const mapping = TOKEN_MAPPINGS.find(m => m.missingToken.contractId === result.contractId);
            console.log(`• ${mapping?.missingToken.name}: ${result.error}`);
        });
        console.log('');
        
        console.log('🔧 TROUBLESHOOTING:');
        console.log('Common issues:');
        console.log('• Authentication required - check if metadata service requires API key');
        console.log('• CORS issues - ensure the metadata service allows updates');
        console.log('• Contract doesn\'t exist - verify contract IDs are correct');
        console.log('• Network issues - check internet connection');
    }
    
    if (successful.length > 0) {
        console.log('🎉 SUCCESS!');
        console.log(`Updated ${successful.length} tokens with real images!`);
        console.log('');
        console.log('Next steps:');
        console.log('1. Verify the images appear correctly in your applications');
        console.log('2. Clear any caches that might be showing old images');
        console.log('3. Check that the token cache picks up the new metadata');
        console.log('');
        console.log('🔄 To refresh the token cache, you can run:');
        console.log('  pnpm script execute-cache-refresh');
    }
}

// Get command line arguments
const mode = process.argv[2] || 'dry-run';
const isLiveMode = mode === 'live';

if (isLiveMode) {
    console.log('⚠️  LIVE MODE - This will make actual updates to the metadata service!');
    console.log('Press Ctrl+C to cancel if you want to review the plan first.');
    console.log('');
}

copyTokenImages(!isLiveMode).catch(console.error);