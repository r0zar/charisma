#!/usr/bin/env tsx

import { kv } from "@vercel/kv";
import { getAllVaultData } from '../src/lib/pool-service';
import { fetchMetadata } from '@repo/tokens';

interface TokenMetadata {
    type: string;
    contractId: string;
    name: string;
    description?: string | null;
    image?: string | null;
    lastUpdated?: number | null;
    decimals?: number;
    symbol: string;
    token_uri?: string | null;
    identifier: string;
    total_supply?: string | null;
    tokenAContract?: string | null;
    tokenBContract?: string | null;
    lpRebatePercent?: number | null;
    externalPoolId?: string | null;
    engineContractId?: string | null;
    base?: string | null;
}

function isPlaceholderImage(imageUrl: string): boolean {
    if (!imageUrl || imageUrl === 'N/A') return true;
    
    const placeholderPatterns = [
        'ui-avatars.com/api/',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAACNJREFUGFdj',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAEElEQVR4nGI',
    ];
    
    return placeholderPatterns.some(pattern => imageUrl.includes(pattern)) ||
           (imageUrl.startsWith('data:image/') && imageUrl.length < 200);
}

function normalizeImageUrl(url: string): string {
    if (!url || url === 'N/A') return '';
    return url.trim().toLowerCase();
}

async function syncLpImagesToMetadata() {
    // Check for dry-run argument
    const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');
    
    console.log(`${isDryRun ? '🔍 DRY RUN: ' : '🔄 LIVE RUN: '}Syncing unique LP token images to metadata cache...\n`);

    try {
        // Get LP tokens from dex-cache
        const lpTokens = await getAllVaultData({ protocol: 'CHARISMA', type: 'POOL' });
        console.log(`Found ${lpTokens.length} LP tokens from dex-cache`);

        // Get all metadata from token cache
        const allMetadata = await fetchMetadata();
        console.log(`Found ${allMetadata.length} tokens in metadata cache`);

        // Create a map of metadata by contractId
        const metadataMap = new Map<string, TokenMetadata>();
        allMetadata.forEach(token => {
            if (token.contractId) {
                metadataMap.set(token.contractId, token);
            }
        });

        // Create a set of all images in metadata cache (normalized)
        const metadataImages = new Set<string>();
        allMetadata.forEach(token => {
            if (token.image && !isPlaceholderImage(token.image)) {
                metadataImages.add(normalizeImageUrl(token.image));
            }
        });

        console.log(`Found ${metadataImages.size} unique non-placeholder images in metadata cache\n`);

        // Find LP tokens with unique images
        const tokensToUpdate: Array<{
            contractId: string;
            currentMetadata: TokenMetadata | null;
            newImage: string;
            reason: string;
        }> = [];

        for (const lpToken of lpTokens) {
            const metadataToken = metadataMap.get(lpToken.contractId);
            const lpImage = lpToken.image || 'N/A';
            const metadataImage = metadataToken?.image || 'N/A';
            
            const lpImageNormalized = normalizeImageUrl(lpImage);
            const isLpPlaceholder = isPlaceholderImage(lpImage);

            // Check if LP has a unique real image not in metadata cache
            if (!isLpPlaceholder && lpImageNormalized && !metadataImages.has(lpImageNormalized)) {
                tokensToUpdate.push({
                    contractId: lpToken.contractId,
                    currentMetadata: metadataToken || null,
                    newImage: lpImage,
                    reason: 'Unique LP image not in metadata cache'
                });
            }
            // Also check if LP has real image but metadata has placeholder
            else if (!isLpPlaceholder && metadataToken && isPlaceholderImage(metadataImage)) {
                tokensToUpdate.push({
                    contractId: lpToken.contractId,
                    currentMetadata: metadataToken,
                    newImage: lpImage,
                    reason: 'LP has real image, metadata has placeholder'
                });
            }
        }

        console.log(`Found ${tokensToUpdate.length} tokens that need image updates\n`);

        if (tokensToUpdate.length === 0) {
            console.log('✅ No tokens need image updates. All LP images are already in metadata cache.');
            return;
        }

        // Show what will be updated
        console.log('TOKENS TO UPDATE:');
        console.log('─'.repeat(120));
        tokensToUpdate.forEach((update, index) => {
            console.log(`${index + 1}. ${update.contractId}`);
            console.log(`   Current image: ${update.currentMetadata?.image || 'None'}`);
            console.log(`   New image: ${update.newImage}`);
            console.log(`   Reason: ${update.reason}`);
            console.log('');
        });

        if (isDryRun) {
            console.log('🔍 DRY RUN MODE: No changes will be made to the metadata cache.\n');
        } else {
            console.log('⚠️  LIVE RUN MODE: This will update the metadata cache KV store.');
            console.log('   Make sure you have the correct KV environment setup.\n');

            console.log('Starting updates...\n');
            let successCount = 0;
            let errorCount = 0;

            for (const update of tokensToUpdate) {
                try {
                    let updatedMetadata: TokenMetadata;

                    if (update.currentMetadata) {
                        // Update existing metadata
                        updatedMetadata = {
                            ...update.currentMetadata,
                            image: update.newImage,
                            lastUpdated: Date.now()
                        };
                    } else {
                        // Create new metadata entry
                        updatedMetadata = {
                            type: 'POOL',
                            contractId: update.contractId,
                            name: update.contractId.split('.')[1] || 'Unknown LP Token',
                            symbol: 'LP',
                            identifier: update.contractId,
                            image: update.newImage,
                            lastUpdated: Date.now(),
                            decimals: 6
                        };
                    }

                    // Update in KV store
                    // Note: You may need to adjust the KV key format based on how the metadata cache stores data
                    const kvKey = `token-metadata:${update.contractId}`;
                    
                    console.log(`🔄 Writing to KV key: ${kvKey}`);
                    console.log(`🔄 Data being written:`, JSON.stringify(updatedMetadata, null, 2));
                    
                    const writeResult = await kv.set(kvKey, updatedMetadata);
                    console.log(`🔄 KV write result:`, writeResult);
                    
                    // Verify the write immediately
                    const verifyRead = await kv.get(kvKey);
                    console.log(`🔄 Immediate verification read:`, verifyRead ? 'SUCCESS' : 'FAILED');

                    console.log(`✅ Updated ${update.contractId}`);
                    successCount++;

                    // Small delay to avoid overwhelming KV
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    console.error(`❌ Failed to update ${update.contractId}:`, error);
                    errorCount++;
                }
            }

            console.log(`\n📊 Update Summary:`);
            console.log(`✅ Successful updates: ${successCount}`);
            console.log(`❌ Failed updates: ${errorCount}`);
            console.log(`📝 Total processed: ${tokensToUpdate.length}`);

            if (successCount > 0) {
                console.log(`\n🔄 The metadata cache may need time to refresh.`);
                console.log(`   You can verify updates by running the fetchMetadata() function again.`);
            }
        }

        // Prepare the data for review/export
        console.log('\n💾 PREPARED UPDATE DATA:');
        console.log('─'.repeat(80));
        
        const updateData = tokensToUpdate.map(update => ({
            contractId: update.contractId,
            action: update.currentMetadata ? 'update' : 'create',
            currentImage: update.currentMetadata?.image || null,
            newImage: update.newImage,
            kvKey: `token-metadata:${update.contractId}`,
            metadata: update.currentMetadata ? {
                ...update.currentMetadata,
                image: update.newImage,
                lastUpdated: Date.now()
            } : {
                type: 'POOL',
                contractId: update.contractId,
                name: update.contractId.split('.')[1] || 'Unknown LP Token',
                symbol: 'LP',
                identifier: update.contractId,
                image: update.newImage,
                lastUpdated: Date.now(),
                decimals: 6
            }
        }));

        // Export the update data
        const { writeFileSync } = await import('fs');
        const exportPath = './metadata-updates.json';
        writeFileSync(exportPath, JSON.stringify(updateData, null, 2));
        console.log(`📁 Update data exported to ${exportPath}`);
        
        if (isDryRun) {
            console.log('\n🔧 To apply these updates for real:');
            console.log('   Run: node scripts/run.js sync-lp-images-to-metadata');
            console.log('   (without the --dry-run flag)');
        }

    } catch (error) {
        console.error('Error syncing LP images to metadata:', error);
        process.exit(1);
    }
}

// Run the script
syncLpImagesToMetadata();