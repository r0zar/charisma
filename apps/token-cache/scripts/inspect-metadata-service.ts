#!/usr/bin/env tsx
// Script to inspect metadata directly from the metadata service

interface TokenWithGeneratedImage {
    contractId: string;
    name: string;
    symbol: string;
    currentImage: string;
}

interface MetadataInspection {
    contractId: string;
    metadataExists: boolean;
    currentImageUrl?: string;
    imageType: 'real' | 'generated' | 'missing' | 'error';
    imageSource: string;
    metadata?: any;
    error?: string;
}

// The 18 tokens needing recovery
const TOKENS_NEEDING_RECOVERY: TokenWithGeneratedImage[] = [
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl', name: 'Anime Demon Girl', symbol: 'ADG', currentImage: 'https://ui-avatars.com/api/?name=ADG&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.banana-coin', name: 'Banana Coin', symbol: 'BANANA', currentImage: 'https://ui-avatars.com/api/?name=BANANA&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.bitcoin-pizza', name: 'Bitcoin Pizza', symbol: 'PIZZA', currentImage: 'https://ui-avatars.com/api/?name=PIZZA&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blueberry-coin', name: 'Blueberry Coin', symbol: 'BLUE', currentImage: 'https://ui-avatars.com/api/?name=BLUE&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-energy', name: 'Charisma Energy', symbol: 'ENERGY', currentImage: 'https://ui-avatars.com/api/?name=ENERGY&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token', name: 'Charisma Token', symbol: 'CHA', currentImage: 'https://ui-avatars.com/api/?name=CHA&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.chow-coin', name: 'Chow Coin', symbol: 'CHOW', currentImage: 'https://ui-avatars.com/api/?name=CHOW&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dungeon-master', name: 'Dungeon Master', symbol: 'DM', currentImage: 'https://ui-avatars.com/api/?name=DM&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.fatigue', name: 'Fatigue', symbol: 'FATIGUE', currentImage: 'https://ui-avatars.com/api/?name=FATIGUE&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.iou-welsh', name: 'IOU Welsh', symbol: 'WELSH', currentImage: 'https://ui-avatars.com/api/?name=WELSH&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.liquid-staked-charisma', name: 'Liquid Staked Charisma', symbol: 'LSCHA', currentImage: 'https://ui-avatars.com/api/?name=LSCHA&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.lovely-coin', name: 'Lovely Coin', symbol: 'LOVELY', currentImage: 'https://ui-avatars.com/api/?name=LOVELY&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.red-pill', name: 'Red Pill', symbol: 'REDPILL', currentImage: 'https://ui-avatars.com/api/?name=REDPILL&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.roo-coin', name: 'Roo Coin', symbol: 'ROO', currentImage: 'https://ui-avatars.com/api/?name=ROO&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.up-dog', name: 'Up Dog', symbol: 'UP', currentImage: 'https://ui-avatars.com/api/?name=UP&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-coin', name: 'Welsh Coin', symbol: 'WELSH', currentImage: 'https://ui-avatars.com/api/?name=WELSH&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.wrapped-bitcoin', name: 'Wrapped Bitcoin', symbol: 'xBTC', currentImage: 'https://ui-avatars.com/api/?name=xBTC&size=200&background=6366f1&color=ffffff&format=png&bold=true' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.wrapped-nothing', name: 'Wrapped Nothing', symbol: 'NOTHING', currentImage: 'https://ui-avatars.com/api/?name=NOTHING&size=200&background=6366f1&color=ffffff&format=png&bold=true' }
];

function analyzeImageType(imageUrl: string): { type: 'real' | 'generated' | 'missing', source: string } {
    if (!imageUrl || imageUrl.trim() === '') {
        return { type: 'missing', source: 'No image URL' };
    }
    
    // Check for UI-Avatars generated images
    if (imageUrl.includes('ui-avatars.com')) {
        return { type: 'generated', source: 'UI-Avatars fallback' };
    }
    
    // Check for placeholder services
    if (imageUrl.includes('placehold.co') || imageUrl.includes('placeholder')) {
        return { type: 'generated', source: 'Placeholder service' };
    }
    
    // Check for data URLs (base64 encoded)
    if (imageUrl.startsWith('data:image/')) {
        return { type: 'real', source: 'Base64 data URL' };
    }
    
    // Check for common image hosting services
    if (imageUrl.includes('cloudinary.com') || 
        imageUrl.includes('s3.amazonaws.com') || 
        imageUrl.includes('vercel.app') ||
        imageUrl.includes('charisma.rocks') ||
        imageUrl.includes('ipfs.io') ||
        imageUrl.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
        return { type: 'real', source: 'External image service' };
    }
    
    return { type: 'real', source: 'Unknown image source' };
}

async function fetchMetadataFromService(contractId: string): Promise<MetadataInspection> {
    const metadataApiUrl = `https://metadata.charisma.rocks/api/v1/metadata/${contractId}`;
    
    try {
        console.log(`  Fetching metadata for ${contractId}...`);
        const response = await fetch(metadataApiUrl, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            return {
                contractId,
                metadataExists: false,
                imageType: 'error',
                imageSource: `HTTP ${response.status}: ${response.statusText}`,
                error: `Failed to fetch metadata: ${response.status} ${response.statusText}`
            };
        }
        
        const metadata = await response.json();
        console.log(`    ✅ Metadata found`);
        
        // Analyze the image
        const imageUrl = metadata.image || '';
        const imageAnalysis = analyzeImageType(imageUrl);
        
        return {
            contractId,
            metadataExists: true,
            currentImageUrl: imageUrl,
            imageType: imageAnalysis.type,
            imageSource: imageAnalysis.source,
            metadata
        };
        
    } catch (error: any) {
        return {
            contractId,
            metadataExists: false,
            imageType: 'error',
            imageSource: 'Network or parsing error',
            error: error.message
        };
    }
}

async function inspectMetadataService(): Promise<void> {
    console.log('🔍 METADATA SERVICE INSPECTION');
    console.log('Fetching metadata directly from metadata.charisma.rocks API...');
    console.log('');
    
    const inspections: MetadataInspection[] = [];
    
    console.log('📥 Fetching metadata for all affected tokens...');
    for (const token of TOKENS_NEEDING_RECOVERY) {
        const inspection = await fetchMetadataFromService(token.contractId);
        inspections.push(inspection);
        
        // Small delay to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('');
    console.log('📊 INSPECTION RESULTS');
    console.log('═'.repeat(80));
    
    // Summary statistics
    const totalTokens = inspections.length;
    const foundMetadata = inspections.filter(i => i.metadataExists).length;
    const missingMetadata = totalTokens - foundMetadata;
    const generatedImages = inspections.filter(i => i.imageType === 'generated').length;
    const realImages = inspections.filter(i => i.imageType === 'real').length;
    const missingImages = inspections.filter(i => i.imageType === 'missing').length;
    const errorImages = inspections.filter(i => i.imageType === 'error').length;
    
    console.log(`Total tokens inspected: ${totalTokens}`);
    console.log(`Metadata found: ${foundMetadata}`);
    console.log(`Metadata missing: ${missingMetadata}`);
    console.log('');
    console.log('IMAGE ANALYSIS:');
    console.log(`  Generated/fallback images: ${generatedImages}`);
    console.log(`  Real images: ${realImages}`);
    console.log(`  Missing images: ${missingImages}`);
    console.log(`  Error fetching: ${errorImages}`);
    console.log('');
    
    // Detailed breakdown
    console.log('🔎 DETAILED BREAKDOWN:');
    console.log('─'.repeat(80));
    
    inspections.forEach((inspection, index) => {
        const token = TOKENS_NEEDING_RECOVERY[index];
        const status = inspection.imageType === 'generated' ? '❌' : 
                      inspection.imageType === 'real' ? '✅' : 
                      inspection.imageType === 'missing' ? '⚪' : '🔴';
        
        console.log(`${status} ${token.name} (${token.symbol})`);
        console.log(`   Contract: ${inspection.contractId}`);
        console.log(`   Metadata exists: ${inspection.metadataExists ? 'Yes' : 'No'}`);
        
        if (inspection.metadataExists) {
            console.log(`   Image URL: ${inspection.currentImageUrl || 'None'}`);
            console.log(`   Image type: ${inspection.imageType}`);
            console.log(`   Image source: ${inspection.imageSource}`);
            
            if (inspection.metadata) {
                console.log(`   Last updated: ${inspection.metadata.lastUpdated || 'Unknown'}`);
                console.log(`   Name: ${inspection.metadata.name || 'Unknown'}`);
                console.log(`   Description: ${inspection.metadata.description ? 'Present' : 'Missing'}`);
                
                // Show additional metadata fields
                const additionalFields = [];
                if (inspection.metadata.properties) additionalFields.push('properties');
                if (inspection.metadata.attributes) additionalFields.push('attributes');
                if (inspection.metadata.external_url) additionalFields.push('external_url');
                if (inspection.metadata.animation_url) additionalFields.push('animation_url');
                
                if (additionalFields.length > 0) {
                    console.log(`   Additional fields: ${additionalFields.join(', ')}`);
                }
            }
        } else {
            console.log(`   Error: ${inspection.error}`);
        }
        console.log('');
    });
    
    // Show full metadata examples
    console.log('📄 SAMPLE METADATA (first 3 tokens):');
    console.log('─'.repeat(80));
    
    inspections.slice(0, 3).forEach((inspection, index) => {
        if (inspection.metadataExists && inspection.metadata) {
            const token = TOKENS_NEEDING_RECOVERY[index];
            console.log(`\n${token.name} (${token.symbol}) METADATA:`);
            console.log(JSON.stringify(inspection.metadata, null, 2));
            console.log('─'.repeat(40));
        }
    });
    
    // Identify patterns in generated images
    console.log('\n🎯 IMAGE URL PATTERNS:');
    console.log('─'.repeat(80));
    
    const urlPatterns = new Map<string, number>();
    
    inspections.forEach(inspection => {
        if (inspection.currentImageUrl) {
            // Extract the pattern from the URL
            let pattern = 'Other';
            
            if (inspection.currentImageUrl.includes('ui-avatars.com')) {
                pattern = 'UI-Avatars (generated)';
            } else if (inspection.currentImageUrl.includes('charisma.rocks')) {
                pattern = 'Charisma.rocks domain';
            } else if (inspection.currentImageUrl.includes('cloudinary.com')) {
                pattern = 'Cloudinary CDN';
            } else if (inspection.currentImageUrl.includes('s3.amazonaws.com')) {
                pattern = 'Amazon S3';
            } else if (inspection.currentImageUrl.startsWith('data:image/')) {
                pattern = 'Base64 data URL';
            } else if (inspection.currentImageUrl.includes('ipfs.io')) {
                pattern = 'IPFS Gateway';
            }
            
            urlPatterns.set(pattern, (urlPatterns.get(pattern) || 0) + 1);
        }
    });
    
    Array.from(urlPatterns.entries()).forEach(([pattern, count]) => {
        console.log(`${pattern}: ${count} tokens`);
    });
    
    console.log('\n🚀 RECOVERY RECOMMENDATIONS:');
    console.log('─'.repeat(80));
    
    if (generatedImages === totalTokens) {
        console.log('❌ ALL TOKENS have generated fallback images');
        console.log('   This confirms systematic overwriting occurred');
        console.log('   Recovery strategy should focus on finding original sources');
    } else if (generatedImages > 0) {
        console.log(`⚠️  ${generatedImages}/${totalTokens} tokens have generated images`);
        console.log('   Partial overwriting occurred');
    } else {
        console.log('✅ No generated images found - tokens may already be recovered');
    }
    
    console.log('\nNext steps:');
    console.log('1. Review the lastUpdated timestamps to identify when overwriting occurred');
    console.log('2. Check if any tokens have real image URLs that could be templates');
    console.log('3. Use the metadata structure to create recovery plan');
    console.log('4. Consider backing up current metadata before making changes');
    
    if (inspections.some(i => i.metadata?.lastUpdated)) {
        console.log('\n📅 LAST UPDATED TIMESTAMPS:');
        console.log('─'.repeat(40));
        
        inspections
            .filter(i => i.metadata?.lastUpdated)
            .sort((a, b) => new Date(b.metadata!.lastUpdated).getTime() - new Date(a.metadata!.lastUpdated).getTime())
            .slice(0, 10)
            .forEach(inspection => {
                const token = TOKENS_NEEDING_RECOVERY.find(t => t.contractId === inspection.contractId);
                console.log(`${token?.symbol}: ${inspection.metadata!.lastUpdated}`);
            });
    }
}

// Run the inspection
inspectMetadataService().catch(console.error);