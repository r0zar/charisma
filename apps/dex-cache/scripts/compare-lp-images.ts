#!/usr/bin/env tsx

import { getAllVaultData } from '../src/lib/pool-service';
import { fetchMetadata } from '@repo/tokens';

interface ImageComparison {
    contractId: string;
    lpImage: string;
    metadataImage: string;
    isUnique: boolean;
    isPlaceholder: boolean;
    imageType: 'unique_lp' | 'same' | 'different' | 'lp_only' | 'metadata_only';
}

function isPlaceholderImage(imageUrl: string): boolean {
    if (!imageUrl || imageUrl === 'N/A') return true;
    
    const placeholderPatterns = [
        'ui-avatars.com/api/',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAACNJREFUGFdj',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAEElEQVR4nGI',
        // Very small base64 images are usually placeholders
    ];
    
    return placeholderPatterns.some(pattern => imageUrl.includes(pattern)) ||
           (imageUrl.startsWith('data:image/') && imageUrl.length < 200);
}

function normalizeImageUrl(url: string): string {
    if (!url || url === 'N/A') return '';
    return url.trim().toLowerCase();
}

async function compareLpImages() {
    console.log('Comparing LP token images with metadata cache...\n');

    try {
        // Get LP tokens from dex-cache
        const lpTokens = await getAllVaultData({ protocol: 'CHARISMA', type: 'POOL' });
        console.log(`Found ${lpTokens.length} LP tokens from dex-cache`);

        // Get all metadata from token cache
        const allMetadata = await fetchMetadata();
        console.log(`Found ${allMetadata.length} tokens in metadata cache\n`);

        // Create a map of metadata by contractId
        const metadataMap = new Map();
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

        console.log(`Found ${metadataImages.size} unique non-placeholder images in metadata cache`);

        // Compare LP token images
        const comparisons: ImageComparison[] = [];
        let uniqueLpImages = 0;
        let placeholderLpImages = 0;
        let realLpImages = 0;

        for (const lpToken of lpTokens) {
            const metadataToken = metadataMap.get(lpToken.contractId);
            const lpImage = lpToken.image || 'N/A';
            const metadataImage = metadataToken?.image || 'N/A';
            
            const lpImageNormalized = normalizeImageUrl(lpImage);
            const isLpPlaceholder = isPlaceholderImage(lpImage);
            
            if (isLpPlaceholder) {
                placeholderLpImages++;
            } else {
                realLpImages++;
            }

            let imageType: ImageComparison['imageType'];
            let isUnique = false;

            if (lpImage === 'N/A') {
                imageType = 'lp_only';
            } else if (metadataImage === 'N/A') {
                imageType = 'metadata_only';
            } else if (normalizeImageUrl(lpImage) === normalizeImageUrl(metadataImage)) {
                imageType = 'same';
            } else {
                imageType = 'different';
            }

            // Check if LP image is unique (not in metadata cache)
            if (!isLpPlaceholder && lpImageNormalized && !metadataImages.has(lpImageNormalized)) {
                isUnique = true;
                uniqueLpImages++;
                imageType = 'unique_lp';
            }

            comparisons.push({
                contractId: lpToken.contractId,
                lpImage,
                metadataImage,
                isUnique,
                isPlaceholder: isLpPlaceholder,
                imageType
            });
        }

        console.log('\n' + '='.repeat(120));
        console.log('IMAGE COMPARISON SUMMARY');
        console.log('='.repeat(120));

        console.log(`\nLP Token Image Statistics:`);
        console.log(`Total LP tokens: ${lpTokens.length}`);
        console.log(`LP tokens with real images: ${realLpImages}`);
        console.log(`LP tokens with placeholder images: ${placeholderLpImages}`);
        console.log(`LP tokens with unique images (not in metadata cache): ${uniqueLpImages}`);

        // Group by image type
        const byType = comparisons.reduce((acc, comp) => {
            acc[comp.imageType] = (acc[comp.imageType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log(`\nImage Type Breakdown:`);
        Object.entries(byType).forEach(([type, count]) => {
            console.log(`${type}: ${count}`);
        });

        // Show unique LP images
        const uniqueImages = comparisons.filter(c => c.isUnique && !c.isPlaceholder);
        
        if (uniqueImages.length > 0) {
            console.log('\n' + '='.repeat(120));
            console.log('UNIQUE LP TOKEN IMAGES (NOT IN METADATA CACHE)');
            console.log('='.repeat(120));

            uniqueImages.forEach((comp, index) => {
                console.log(`\n${index + 1}. ${comp.contractId}`);
                console.log(`   LP Image: ${comp.lpImage}`);
                console.log(`   Metadata Image: ${comp.metadataImage}`);
                console.log(`   Status: Unique to LP token data`);
            });

            console.log('\n📋 UNIQUE IMAGE URLS (for easy copying):');
            console.log('─'.repeat(80));
            uniqueImages.forEach((comp, index) => {
                console.log(`${index + 1}. ${comp.lpImage}`);
            });
        } else {
            console.log('\n✅ No unique real images found in LP token data that are missing from metadata cache.');
        }

        // Show different images (same contract, different image)
        const differentImages = comparisons.filter(c => c.imageType === 'different' && !c.isPlaceholder);
        
        if (differentImages.length > 0) {
            console.log('\n' + '='.repeat(120));
            console.log('CONTRACTS WITH DIFFERENT IMAGES BETWEEN LP DATA AND METADATA CACHE');
            console.log('='.repeat(120));

            differentImages.forEach((comp, index) => {
                console.log(`\n${index + 1}. ${comp.contractId}`);
                console.log(`   LP Image:       ${comp.lpImage}`);
                console.log(`   Metadata Image: ${comp.metadataImage}`);
                console.log(`   Status: Different images for same contract`);
            });
        }

        // Export option
        console.log('\n💾 To export detailed comparison data to JSON:');
        console.log('// const fs = require("fs");');
        console.log('// fs.writeFileSync("./lp-image-comparison.json", JSON.stringify(comparisons, null, 2));');
        
        // Uncomment these lines to export to JSON file:
        // const fs = require('fs');
        // const exportPath = './lp-image-comparison.json';
        // fs.writeFileSync(exportPath, JSON.stringify(comparisons, null, 2));
        // console.log(`\n✅ Comparison data exported to ${exportPath}`);

    } catch (error) {
        console.error('Error comparing LP images:', error);
        process.exit(1);
    }
}

// Run the script
compareLpImages();