#!/usr/bin/env tsx
// Script to inspect the Vercel KV store used by the metadata service

import { kv } from '@vercel/kv';

interface StoredMetadata {
    contractId: string;
    keyType: 'metadata' | 'legacy';
    key: string;
    metadata: any;
    hasImage: boolean;
    imageUrl?: string;
    imageType: 'real' | 'generated' | 'missing';
    lastUpdated?: string;
}

function analyzeImageType(imageUrl: string): 'real' | 'generated' | 'missing' {
    if (!imageUrl || imageUrl.trim() === '') {
        return 'missing';
    }
    
    if (imageUrl.includes('ui-avatars.com') || 
        imageUrl.includes('placehold.co') || 
        imageUrl.includes('placeholder')) {
        return 'generated';
    }
    
    return 'real';
}

async function scanAllKeys(prefix: string): Promise<string[]> {
    let cursor = 0;
    let keys: string[] = [];
    
    do {
        try {
            const result = await kv.scan(cursor, { match: `${prefix}*`, count: 1000 });
            const [nextCursor, batch] = result;
            keys.push(...batch);
            cursor = Number(nextCursor);
        } catch (error) {
            console.error(`Error scanning keys with prefix ${prefix}:`, error);
            break;
        }
    } while (cursor !== 0);
    
    return keys;
}

async function inspectKVStore(): Promise<void> {
    console.log('🔍 METADATA KV STORE INSPECTION');
    console.log('Scanning Vercel KV store for all stored metadata...');
    console.log('');
    
    try {
        // Get all keys from both prefixes
        console.log('📥 Scanning for metadata keys...');
        
        const metadataKeys = await scanAllKeys('metadata:');
        const legacyKeys = await scanAllKeys('sip10:');
        
        console.log(`Found ${metadataKeys.length} metadata: keys`);
        console.log(`Found ${legacyKeys.length} sip10: keys`);
        console.log('');
        
        if (metadataKeys.length === 0 && legacyKeys.length === 0) {
            console.log('❌ No metadata keys found in KV store');
            console.log('');
            console.log('Possible reasons:');
            console.log('  • KV store is empty');
            console.log('  • Environment variables not configured correctly');
            console.log('  • Different key prefixes being used');
            return;
        }
        
        // Combine and analyze all keys
        const allKeys = [
            ...metadataKeys.map(key => ({ key, type: 'metadata' as const, contractId: key.replace('metadata:', '') })),
            ...legacyKeys.map(key => ({ key, type: 'legacy' as const, contractId: key.replace('sip10:', '') }))
        ];
        
        console.log('📊 RETRIEVING METADATA...');
        const storedMetadata: StoredMetadata[] = [];
        
        for (const { key, type, contractId } of allKeys) {
            try {
                console.log(`  Fetching ${contractId}...`);
                const metadata = await kv.get(key);
                
                if (metadata) {
                    const hasImage = !!(metadata as any).image;
                    const imageUrl = (metadata as any).image || '';
                    const imageType = analyzeImageType(imageUrl);
                    
                    storedMetadata.push({
                        contractId,
                        keyType: type,
                        key,
                        metadata,
                        hasImage,
                        imageUrl,
                        imageType,
                        lastUpdated: (metadata as any).lastUpdated
                    });
                }
            } catch (error) {
                console.error(`  Error fetching ${contractId}:`, error);
            }
        }
        
        console.log('');
        console.log('📊 KV STORE ANALYSIS');
        console.log('═'.repeat(80));
        
        // Summary statistics
        const totalEntries = storedMetadata.length;
        const metadataEntries = storedMetadata.filter(s => s.keyType === 'metadata').length;
        const legacyEntries = storedMetadata.filter(s => s.keyType === 'legacy').length;
        const entriesWithImages = storedMetadata.filter(s => s.hasImage).length;
        const entriesWithRealImages = storedMetadata.filter(s => s.imageType === 'real').length;
        const entriesWithGeneratedImages = storedMetadata.filter(s => s.imageType === 'generated').length;
        const entriesWithMissingImages = storedMetadata.filter(s => s.imageType === 'missing').length;
        
        console.log(`Total entries: ${totalEntries}`);
        console.log(`  metadata: prefix: ${metadataEntries}`);
        console.log(`  sip10: prefix: ${legacyEntries}`);
        console.log('');
        console.log('IMAGE ANALYSIS:');
        console.log(`  Entries with images: ${entriesWithImages}/${totalEntries}`);
        console.log(`  Real images: ${entriesWithRealImages}`);
        console.log(`  Generated images: ${entriesWithGeneratedImages}`);
        console.log(`  Missing images: ${entriesWithMissingImages}`);
        console.log('');
        
        // Show all stored tokens
        console.log('🗂️  ALL STORED TOKENS:');
        console.log('─'.repeat(80));
        
        storedMetadata
            .sort((a, b) => a.contractId.localeCompare(b.contractId))
            .forEach(entry => {
                const status = entry.imageType === 'real' ? '✅' : 
                              entry.imageType === 'generated' ? '❌' : '⚪';
                
                console.log(`${status} ${entry.contractId} (${entry.keyType})`);
                console.log(`   Name: ${(entry.metadata as any).name || 'Unknown'}`);
                console.log(`   Symbol: ${(entry.metadata as any).symbol || 'Unknown'}`);
                
                if (entry.hasImage) {
                    console.log(`   Image: ${entry.imageUrl}`);
                    console.log(`   Image type: ${entry.imageType}`);
                } else {
                    console.log(`   Image: None`);
                }
                
                if (entry.lastUpdated) {
                    const date = new Date(Number(entry.lastUpdated));
                    console.log(`   Last updated: ${date.toISOString()}`);
                }
                console.log('');
            });
        
        // Check for our specific problem tokens
        console.log('🎯 CHECKING PROBLEM TOKENS:');
        console.log('─'.repeat(80));
        
        const problemTokens = [
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.banana-coin',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.bitcoin-pizza',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-coin'
        ];
        
        problemTokens.forEach(contractId => {
            const stored = storedMetadata.find(s => s.contractId === contractId);
            if (stored) {
                console.log(`✅ ${contractId} - FOUND in KV store`);
                console.log(`   Key type: ${stored.keyType}`);
                console.log(`   Image type: ${stored.imageType}`);
                if (stored.imageUrl) {
                    console.log(`   Image URL: ${stored.imageUrl}`);
                }
            } else {
                console.log(`❌ ${contractId} - NOT FOUND in KV store`);
            }
        });
        
        console.log('');
        console.log('🔎 IMAGE URL PATTERNS:');
        console.log('─'.repeat(80));
        
        const urlPatterns = new Map<string, number>();
        
        storedMetadata.forEach(entry => {
            if (entry.imageUrl) {
                let pattern = 'Other';
                
                if (entry.imageUrl.includes('ui-avatars.com')) {
                    pattern = 'UI-Avatars (generated)';
                } else if (entry.imageUrl.includes('vercel-storage.com') || entry.imageUrl.includes('blob.vercel-storage.com')) {
                    pattern = 'Vercel Blob Storage';
                } else if (entry.imageUrl.includes('charisma.rocks')) {
                    pattern = 'Charisma.rocks domain';
                } else if (entry.imageUrl.includes('cloudinary.com')) {
                    pattern = 'Cloudinary CDN';
                } else if (entry.imageUrl.startsWith('data:image/')) {
                    pattern = 'Base64 data URL';
                } else if (entry.imageUrl.includes('ipfs.io')) {
                    pattern = 'IPFS Gateway';
                }
                
                urlPatterns.set(pattern, (urlPatterns.get(pattern) || 0) + 1);
            }
        });
        
        Array.from(urlPatterns.entries()).forEach(([pattern, count]) => {
            console.log(`${pattern}: ${count} tokens`);
        });
        
        console.log('');
        console.log('🚀 INSIGHTS & NEXT STEPS:');
        console.log('─'.repeat(80));
        
        if (entriesWithGeneratedImages > 0) {
            console.log(`❌ Found ${entriesWithGeneratedImages} tokens with generated images in KV store`);
            console.log('   These need to be updated with real images');
        }
        
        if (totalEntries < 18) {
            console.log(`⚠️  Only ${totalEntries} tokens found in KV store, expected around 79+ tokens`);
            console.log('   Many tokens may not have metadata stored yet');
        }
        
        const duplicateContracts = new Map<string, number>();
        storedMetadata.forEach(entry => {
            duplicateContracts.set(entry.contractId, (duplicateContracts.get(entry.contractId) || 0) + 1);
        });
        
        const duplicates = Array.from(duplicateContracts.entries()).filter(([, count]) => count > 1);
        if (duplicates.length > 0) {
            console.log(`⚠️  Found ${duplicates.length} contracts with duplicate entries:`);
            duplicates.forEach(([contractId, count]) => {
                console.log(`   ${contractId}: ${count} entries`);
            });
            console.log('   Consider consolidating to metadata: prefix only');
        }
        
        console.log('');
        console.log('RECOMMENDED ACTIONS:');
        console.log('1. For tokens with generated images: find/create real images and update');
        console.log('2. For missing tokens: add their metadata to the KV store');
        console.log('3. For duplicates: migrate legacy entries to metadata: prefix');
        console.log('4. Backup KV store before making changes');
        
    } catch (error: any) {
        console.error('❌ Error inspecting KV store:', error.message);
        console.log('');
        console.log('Possible issues:');
        console.log('  • KV_REST_API_URL not configured');
        console.log('  • KV_REST_API_TOKEN not configured');
        console.log('  • Network connectivity issues');
        console.log('  • Insufficient permissions');
    }
}

// Run the inspection
inspectKVStore().catch(console.error);