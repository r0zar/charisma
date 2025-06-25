#!/usr/bin/env tsx
// Script to scan @apps/metadata/ for stored images and match them to tokens needing recovery

import { readdir, stat, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import { createHash } from 'crypto';

interface TokenWithGeneratedImage {
    contractId: string;
    name: string;
    symbol: string;
    currentImage: string;
    imageType: 'generated' | 'missing';
}

interface FoundImage {
    path: string;
    filename: string;
    size: number;
    hash: string;
    contractMatch?: string;
    similarity?: number;
}

interface ImageMatch {
    token: TokenWithGeneratedImage;
    candidateImages: FoundImage[];
    bestMatch?: FoundImage;
}

// List of tokens with generated/missing images from previous audit
const TOKENS_NEEDING_RECOVERY: TokenWithGeneratedImage[] = [
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl', name: 'Anime Demon Girl', symbol: 'ADG', currentImage: 'https://ui-avatars.com/api/?name=ADG&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.banana-coin', name: 'Banana Coin', symbol: 'BANANA', currentImage: 'https://ui-avatars.com/api/?name=BANANA&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.bitcoin-pizza', name: 'Bitcoin Pizza', symbol: 'PIZZA', currentImage: 'https://ui-avatars.com/api/?name=PIZZA&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blueberry-coin', name: 'Blueberry Coin', symbol: 'BLUE', currentImage: 'https://ui-avatars.com/api/?name=BLUE&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-energy', name: 'Charisma Energy', symbol: 'ENERGY', currentImage: 'https://ui-avatars.com/api/?name=ENERGY&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token', name: 'Charisma Token', symbol: 'CHA', currentImage: 'https://ui-avatars.com/api/?name=CHA&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.chow-coin', name: 'Chow Coin', symbol: 'CHOW', currentImage: 'https://ui-avatars.com/api/?name=CHOW&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dungeon-master', name: 'Dungeon Master', symbol: 'DM', currentImage: 'https://ui-avatars.com/api/?name=DM&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.fatigue', name: 'Fatigue', symbol: 'FATIGUE', currentImage: 'https://ui-avatars.com/api/?name=FATIGUE&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.iou-welsh', name: 'IOU Welsh', symbol: 'WELSH', currentImage: 'https://ui-avatars.com/api/?name=WELSH&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.liquid-staked-charisma', name: 'Liquid Staked Charisma', symbol: 'LSCHA', currentImage: 'https://ui-avatars.com/api/?name=LSCHA&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.lovely-coin', name: 'Lovely Coin', symbol: 'LOVELY', currentImage: 'https://ui-avatars.com/api/?name=LOVELY&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.red-pill', name: 'Red Pill', symbol: 'REDPILL', currentImage: 'https://ui-avatars.com/api/?name=REDPILL&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.roo-coin', name: 'Roo Coin', symbol: 'ROO', currentImage: 'https://ui-avatars.com/api/?name=ROO&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.up-dog', name: 'Up Dog', symbol: 'UP', currentImage: 'https://ui-avatars.com/api/?name=UP&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-coin', name: 'Welsh Coin', symbol: 'WELSH', currentImage: 'https://ui-avatars.com/api/?name=WELSH&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.wrapped-bitcoin', name: 'Wrapped Bitcoin', symbol: 'xBTC', currentImage: 'https://ui-avatars.com/api/?name=xBTC&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.wrapped-nothing', name: 'Wrapped Nothing', symbol: 'NOTHING', currentImage: 'https://ui-avatars.com/api/?name=NOTHING&size=200&background=6366f1&color=ffffff&format=png&bold=true', imageType: 'generated' }
];

// Common directories to search for images
const SEARCH_DIRECTORIES = [
    '/home/rozar/Documents/charisma/charisma/apps/metadata',
    '/home/rozar/Documents/charisma/charisma/apps/metadata/public',
    '/home/rozar/Documents/charisma/charisma/apps/metadata/src',
    '/home/rozar/Documents/charisma/charisma/apps/metadata/assets',
    '/home/rozar/Documents/charisma/charisma/apps/metadata/static',
    '/home/rozar/Documents/charisma/charisma/apps/metadata/images'
];

// Common image extensions
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'];

async function calculateFileHash(filePath: string): Promise<string> {
    try {
        const fileBuffer = await readFile(filePath);
        return createHash('md5').update(fileBuffer).digest('hex');
    } catch (error) {
        return '';
    }
}

async function scanDirectoryForImages(dirPath: string): Promise<FoundImage[]> {
    const images: FoundImage[] = [];
    
    try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                // Recursively scan subdirectories
                const subImages = await scanDirectoryForImages(fullPath);
                images.push(...subImages);
            } else if (entry.isFile()) {
                const ext = extname(entry.name).toLowerCase();
                if (IMAGE_EXTENSIONS.includes(ext)) {
                    try {
                        const stats = await stat(fullPath);
                        const hash = await calculateFileHash(fullPath);
                        
                        images.push({
                            path: fullPath,
                            filename: entry.name,
                            size: stats.size,
                            hash
                        });
                    } catch (error) {
                        console.warn(`Failed to process image ${fullPath}:`, error);
                    }
                }
            }
        }
    } catch (error) {
        // Directory doesn't exist or can't be read, skip silently
    }
    
    return images;
}

function calculateNameSimilarity(tokenName: string, filename: string): number {
    const tokenWords = tokenName.toLowerCase().split(/[\s\-_]+/);
    const fileWords = basename(filename, extname(filename)).toLowerCase().split(/[\s\-_]+/);
    
    let matches = 0;
    let totalWords = Math.max(tokenWords.length, fileWords.length);
    
    for (const tokenWord of tokenWords) {
        for (const fileWord of fileWords) {
            if (tokenWord === fileWord || 
                tokenWord.includes(fileWord) || 
                fileWord.includes(tokenWord)) {
                matches++;
                break;
            }
        }
    }
    
    return totalWords > 0 ? (matches / totalWords) * 100 : 0;
}

function calculateSymbolSimilarity(tokenSymbol: string, filename: string): number {
    const filenameBase = basename(filename, extname(filename)).toLowerCase();
    const symbol = tokenSymbol.toLowerCase();
    
    if (filenameBase === symbol) return 100;
    if (filenameBase.includes(symbol) || symbol.includes(filenameBase)) return 80;
    
    // Check for partial matches
    const symbolChars = symbol.split('');
    const filenameChars = filenameBase.split('');
    let matches = 0;
    
    for (const char of symbolChars) {
        if (filenameChars.includes(char)) {
            matches++;
        }
    }
    
    return symbolChars.length > 0 ? (matches / symbolChars.length) * 50 : 0;
}

function calculateContractSimilarity(contractId: string, filename: string): number {
    const contractName = contractId.split('.')[1];
    if (!contractName) return 0;
    
    const filenameBase = basename(filename, extname(filename)).toLowerCase();
    const contractLower = contractName.toLowerCase();
    
    if (filenameBase === contractLower) return 100;
    if (filenameBase.includes(contractLower) || contractLower.includes(filenameBase)) return 90;
    
    // Check for word matches
    const contractWords = contractLower.split(/[\s\-_]+/);
    const filenameWords = filenameBase.split(/[\s\-_]+/);
    
    let matches = 0;
    for (const contractWord of contractWords) {
        if (filenameWords.includes(contractWord)) {
            matches++;
        }
    }
    
    return contractWords.length > 0 ? (matches / contractWords.length) * 80 : 0;
}

function findBestMatches(token: TokenWithGeneratedImage, images: FoundImage[]): FoundImage[] {
    const matches: Array<FoundImage & { totalSimilarity: number }> = [];
    
    for (const image of images) {
        const nameSimilarity = calculateNameSimilarity(token.name, image.filename);
        const symbolSimilarity = calculateSymbolSimilarity(token.symbol, image.filename);
        const contractSimilarity = calculateContractSimilarity(token.contractId, image.filename);
        
        // Weighted scoring: contract name has highest weight, then symbol, then full name
        const totalSimilarity = (contractSimilarity * 0.5) + (symbolSimilarity * 0.3) + (nameSimilarity * 0.2);
        
        if (totalSimilarity > 10) { // Only include matches with some similarity
            matches.push({
                ...image,
                totalSimilarity,
                contractMatch: `${contractSimilarity.toFixed(1)}% contract, ${symbolSimilarity.toFixed(1)}% symbol, ${nameSimilarity.toFixed(1)}% name`
            });
        }
    }
    
    // Sort by similarity and return top matches
    return matches
        .sort((a, b) => b.totalSimilarity - a.totalSimilarity)
        .slice(0, 5)
        .map(({ totalSimilarity, contractMatch, ...image }) => ({
            ...image,
            similarity: totalSimilarity,
            contractMatch
        }));
}

async function scanForStoredImages(): Promise<void> {
    console.log('🔍 Scanning for stored images that could recover tokens with generated placeholders\n');
    
    console.log('📋 Tokens needing image recovery:');
    TOKENS_NEEDING_RECOVERY.forEach((token, index) => {
        console.log(`  ${index + 1}. ${token.name} (${token.symbol}) - ${token.contractId}`);
    });
    console.log('');
    
    console.log('🔎 Scanning directories for images...');
    const allImages: FoundImage[] = [];
    
    for (const dir of SEARCH_DIRECTORIES) {
        console.log(`  Scanning: ${dir}`);
        const images = await scanDirectoryForImages(dir);
        allImages.push(...images);
        console.log(`    Found ${images.length} images`);
    }
    
    console.log(`\n📊 Total images found: ${allImages.length}`);
    
    if (allImages.length === 0) {
        console.log('❌ No images found in scanned directories.');
        console.log('\n💡 Possible reasons:');
        console.log('  • Images are stored externally (S3, Cloudinary, etc.)');
        console.log('  • Images are in different directories not scanned');
        console.log('  • Original images were not backed up locally');
        console.log('\n🔧 Next steps:');
        console.log('  1. Check external storage services for backups');
        console.log('  2. Search git history for removed image files');
        console.log('  3. Contact team members who may have original images');
        return;
    }
    
    console.log('\n🎯 Matching images to tokens...\n');
    
    const matches: ImageMatch[] = [];
    let totalMatches = 0;
    
    for (const token of TOKENS_NEEDING_RECOVERY) {
        const candidateImages = findBestMatches(token, allImages);
        
        const match: ImageMatch = {
            token,
            candidateImages,
            bestMatch: candidateImages.length > 0 ? candidateImages[0] : undefined
        };
        
        matches.push(match);
        
        if (candidateImages.length > 0) {
            totalMatches++;
            console.log(`✅ ${token.name} (${token.symbol})`);
            console.log(`   Contract: ${token.contractId}`);
            console.log(`   Best match: ${candidateImages[0].filename} (${candidateImages[0].similarity?.toFixed(1)}% similarity)`);
            console.log(`   Path: ${candidateImages[0].path}`);
            console.log(`   Size: ${Math.round(candidateImages[0].size / 1024)}KB`);
            console.log(`   Match details: ${candidateImages[0].contractMatch}`);
            
            if (candidateImages.length > 1) {
                console.log('   Other candidates:');
                candidateImages.slice(1).forEach((img, idx) => {
                    console.log(`     ${idx + 2}. ${img.filename} (${img.similarity?.toFixed(1)}% similarity)`);
                });
            }
            console.log('');
        } else {
            console.log(`❌ ${token.name} (${token.symbol}) - No similar images found`);
        }
    }
    
    console.log('━'.repeat(80));
    console.log('📈 RECOVERY ANALYSIS SUMMARY');
    console.log('━'.repeat(80));
    console.log(`Tokens needing recovery: ${TOKENS_NEEDING_RECOVERY.length}`);
    console.log(`Tokens with potential image matches: ${totalMatches}`);
    console.log(`Tokens still needing images: ${TOKENS_NEEDING_RECOVERY.length - totalMatches}`);
    console.log(`Recovery success rate: ${((totalMatches / TOKENS_NEEDING_RECOVERY.length) * 100).toFixed(1)}%`);
    
    if (totalMatches > 0) {
        console.log('\n🎯 RECOVERY PLAN');
        console.log('━'.repeat(80));
        console.log('For tokens with matches, you can:');
        console.log('');
        console.log('1. Manual Recovery (Recommended):');
        console.log('   • Review each match to verify it\'s the correct image');
        console.log('   • Upload verified images to your image storage service');
        console.log('   • Update metadata via the admin interface');
        console.log('');
        console.log('2. Automated Recovery (Use with caution):');
        console.log('   • Create recovery script to batch update high-confidence matches');
        console.log('   • Test with a few tokens first');
        console.log('');
        
        console.log('🔧 HIGH-CONFIDENCE MATCHES (>80% similarity):');
        const highConfidenceMatches = matches.filter(m => m.bestMatch && m.bestMatch.similarity! > 80);
        if (highConfidenceMatches.length > 0) {
            highConfidenceMatches.forEach(match => {
                console.log(`  • ${match.token.symbol}: ${match.bestMatch!.filename} (${match.bestMatch!.similarity!.toFixed(1)}%)`);
            });
        } else {
            console.log('  None found - all matches require manual review');
        }
        
        console.log('\n⚠️  MEDIUM-CONFIDENCE MATCHES (40-80% similarity):');
        const mediumConfidenceMatches = matches.filter(m => m.bestMatch && m.bestMatch.similarity! >= 40 && m.bestMatch.similarity! <= 80);
        if (mediumConfidenceMatches.length > 0) {
            mediumConfidenceMatches.forEach(match => {
                console.log(`  • ${match.token.symbol}: ${match.bestMatch!.filename} (${match.bestMatch!.similarity!.toFixed(1)}%)`);
            });
        } else {
            console.log('  None found');
        }
    }
    
    console.log('\n💾 All scanned images:');
    console.log('━'.repeat(40));
    const imagesByDir = allImages.reduce((acc, img) => {
        const dir = img.path.substring(0, img.path.lastIndexOf('/'));
        if (!acc[dir]) acc[dir] = [];
        acc[dir].push(img);
        return acc;
    }, {} as Record<string, FoundImage[]>);
    
    Object.entries(imagesByDir).forEach(([dir, images]) => {
        console.log(`\n📁 ${dir}:`);
        images.slice(0, 10).forEach(img => {
            console.log(`  • ${img.filename} (${Math.round(img.size / 1024)}KB)`);
        });
        if (images.length > 10) {
            console.log(`  ... and ${images.length - 10} more images`);
        }
    });
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('━'.repeat(40));
    console.log('1. Review the matches above and verify they are correct');
    console.log('2. For confirmed matches, create a recovery script to:');
    console.log('   • Upload images to your storage service');
    console.log('   • Update the charisma.rocks metadata API');
    console.log('   • Refresh the token cache');
    console.log('3. For tokens without matches, consider:');
    console.log('   • Checking external backups');
    console.log('   • Searching git history');
    console.log('   • Creating new images or finding alternatives');
    console.log('4. Implement safeguards to prevent future overwrites');
}

// Run the scan
scanForStoredImages().catch(console.error);