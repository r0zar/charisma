#!/usr/bin/env tsx
// Script to list all metadata entries using the metadata service API

interface MetadataEntry {
    contractId: string;
    name?: string;
    symbol?: string;
    image?: string;
    lastUpdated?: string;
    hasRealImage: boolean;
    imageSource: string;
}

function analyzeImageSource(imageUrl: string): { hasReal: boolean; source: string } {
    if (!imageUrl || imageUrl.trim() === '') {
        return { hasReal: false, source: 'No image' };
    }
    
    if (imageUrl.includes('ui-avatars.com')) {
        return { hasReal: false, source: 'UI-Avatars (generated)' };
    }
    
    if (imageUrl.includes('placehold.co') || imageUrl.includes('placeholder')) {
        return { hasReal: false, source: 'Placeholder service' };
    }
    
    if (imageUrl.includes('vercel-storage.com') || imageUrl.includes('blob.vercel-storage.com')) {
        return { hasReal: true, source: 'Vercel Blob Storage' };
    }
    
    if (imageUrl.includes('charisma.rocks')) {
        return { hasReal: true, source: 'Charisma.rocks domain' };
    }
    
    if (imageUrl.includes('cloudinary.com')) {
        return { hasReal: true, source: 'Cloudinary CDN' };
    }
    
    if (imageUrl.startsWith('data:image/')) {
        return { hasReal: true, source: 'Base64 data URL' };
    }
    
    if (imageUrl.includes('ipfs.io') || imageUrl.startsWith('ipfs://')) {
        return { hasReal: true, source: 'IPFS' };
    }
    
    return { hasReal: true, source: 'External URL' };
}

async function listAllMetadataEntries(): Promise<void> {
    console.log('📋 METADATA SERVICE - LIST ALL ENTRIES');
    console.log('Fetching all metadata entries from the metadata service...');
    console.log('');
    
    try {
        // Fetch the list of all metadata entries
        const listUrl = 'https://metadata.charisma.rocks/api/v1/metadata/list';
        console.log('📥 Fetching metadata list...');
        
        const response = await fetch(listUrl, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            console.error(`❌ Failed to fetch metadata list: ${response.status} ${response.statusText}`);
            return;
        }
        
        const result = await response.json();
        
        if (!result.success || !result.metadata) {
            console.error('❌ Invalid response format from metadata service');
            console.log('Response:', result);
            return;
        }
        
        const entries: any[] = result.metadata;
        console.log(`✅ Found ${entries.length} metadata entries`);
        console.log('');
        
        // Process and analyze entries
        const analyzedEntries: MetadataEntry[] = entries.map(entry => {
            const imageAnalysis = analyzeImageSource(entry.image || '');
            
            return {
                contractId: entry.contractId || 'Unknown',
                name: entry.name,
                symbol: entry.symbol,
                image: entry.image,
                lastUpdated: entry.lastUpdated,
                hasRealImage: imageAnalysis.hasReal,
                imageSource: imageAnalysis.source
            };
        });
        
        // Summary statistics
        const totalEntries = analyzedEntries.length;
        const entriesWithImages = analyzedEntries.filter(e => e.image).length;
        const entriesWithRealImages = analyzedEntries.filter(e => e.hasRealImage).length;
        const entriesWithGeneratedImages = analyzedEntries.filter(e => e.image && !e.hasRealImage).length;
        const entriesWithoutImages = analyzedEntries.filter(e => !e.image).length;
        
        console.log('📊 SUMMARY STATISTICS');
        console.log('═'.repeat(80));
        console.log(`Total metadata entries: ${totalEntries}`);
        console.log(`Entries with images: ${entriesWithImages}`);
        console.log(`Entries with real images: ${entriesWithRealImages}`);
        console.log(`Entries with generated images: ${entriesWithGeneratedImages}`);
        console.log(`Entries without images: ${entriesWithoutImages}`);
        console.log('');
        
        // Show all entries
        console.log('🗂️  ALL METADATA ENTRIES');
        console.log('─'.repeat(80));
        
        analyzedEntries
            .sort((a, b) => a.contractId.localeCompare(b.contractId))
            .forEach((entry, index) => {
                const status = entry.hasRealImage ? '✅' : entry.image ? '❌' : '⚪';
                
                console.log(`${index + 1}. ${status} ${entry.name || 'Unknown'} (${entry.symbol || 'Unknown'})`);
                console.log(`    Contract: ${entry.contractId}`);
                
                if (entry.image) {
                    console.log(`    Image: ${entry.image}`);
                    console.log(`    Source: ${entry.imageSource}`);
                } else {
                    console.log(`    Image: None`);
                }
                
                if (entry.lastUpdated) {
                    try {
                        const date = new Date(Number(entry.lastUpdated));
                        console.log(`    Last updated: ${date.toISOString()}`);
                    } catch {
                        console.log(`    Last updated: ${entry.lastUpdated}`);
                    }
                }
                console.log('');
            });
        
        // Image source breakdown
        console.log('🔎 IMAGE SOURCES BREAKDOWN');
        console.log('─'.repeat(80));
        
        const sourceCount = new Map<string, number>();
        analyzedEntries.forEach(entry => {
            sourceCount.set(entry.imageSource, (sourceCount.get(entry.imageSource) || 0) + 1);
        });
        
        Array.from(sourceCount.entries())
            .sort(([, a], [, b]) => b - a)
            .forEach(([source, count]) => {
                console.log(`${source}: ${count} entries`);
            });
        
        // Check our problem tokens specifically
        console.log('');
        console.log('🎯 PROBLEM TOKENS STATUS');
        console.log('─'.repeat(80));
        
        const problemTokens = [
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.banana-coin',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.bitcoin-pizza',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blueberry-coin',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-energy',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-coin',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.wrapped-bitcoin'
        ];
        
        problemTokens.forEach(contractId => {
            const entry = analyzedEntries.find(e => e.contractId === contractId);
            if (entry) {
                const status = entry.hasRealImage ? '✅ REAL IMAGE' : entry.image ? '❌ GENERATED' : '⚪ NO IMAGE';
                console.log(`${status} - ${entry.name} (${entry.symbol})`);
                if (entry.image) {
                    console.log(`    ${entry.image}`);
                }
            } else {
                console.log(`❌ NOT FOUND - ${contractId}`);
            }
        });
        
        // Show entries that need recovery
        const needsRecovery = analyzedEntries.filter(e => e.image && !e.hasRealImage);
        if (needsRecovery.length > 0) {
            console.log('');
            console.log('🚨 ENTRIES NEEDING IMAGE RECOVERY');
            console.log('─'.repeat(80));
            
            needsRecovery.forEach(entry => {
                console.log(`❌ ${entry.name} (${entry.symbol})`);
                console.log(`    Contract: ${entry.contractId}`);
                console.log(`    Current image: ${entry.image}`);
                console.log('');
            });
        }
        
        // Recommendations
        console.log('🚀 RECOMMENDATIONS');
        console.log('─'.repeat(80));
        
        if (entriesWithGeneratedImages > 0) {
            console.log(`1. ${entriesWithGeneratedImages} entries have generated/fallback images`);
            console.log('   → Find original images and update using the upload API');
        }
        
        if (entriesWithoutImages > 0) {
            console.log(`2. ${entriesWithoutImages} entries have no images`);
            console.log('   → Create or source appropriate images');
        }
        
        if (totalEntries < 50) {
            console.log(`3. Only ${totalEntries} entries in metadata service`);
            console.log('   → Many tokens may not be registered in the metadata service');
        }
        
        console.log('');
        console.log('Next steps:');
        console.log('• Use the upload API to add real images for tokens with generated ones');
        console.log('• Check if missing tokens need to be added to the metadata service');
        console.log('• Create a backup of current metadata before making changes');
        
    } catch (error: any) {
        console.error('❌ Error listing metadata entries:', error.message);
        console.log('');
        console.log('This could indicate:');
        console.log('• Network connectivity issues');
        console.log('• Metadata service is down');
        console.log('• API endpoint has changed');
    }
}

// Run the listing
listAllMetadataEntries().catch(console.error);