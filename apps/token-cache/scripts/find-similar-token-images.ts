#!/usr/bin/env tsx
// Script to find tokens with similar names/symbols that might have the images we need

interface TokenEntry {
    contractId: string;
    name?: string;
    symbol?: string;
    image?: string;
    hasRealImage: boolean;
    imageSource: string;
}

interface SimilarityMatch {
    targetToken: string;
    candidateToken: TokenEntry;
    similarity: number;
    matchType: 'name' | 'symbol' | 'contract' | 'combined';
    confidence: 'high' | 'medium' | 'low';
}

// Our 18 missing tokens
const MISSING_TOKENS = [
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl', name: 'Anime Demon Girl', symbol: 'ADG' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.banana-coin', name: 'Banana Coin', symbol: 'BANANA' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.bitcoin-pizza', name: 'Bitcoin Pizza', symbol: 'PIZZA' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blueberry-coin', name: 'Blueberry Coin', symbol: 'BLUE' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-energy', name: 'Charisma Energy', symbol: 'ENERGY' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token', name: 'Charisma Token', symbol: 'CHA' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.chow-coin', name: 'Chow Coin', symbol: 'CHOW' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dungeon-master', name: 'Dungeon Master', symbol: 'DM' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.fatigue', name: 'Fatigue', symbol: 'FATIGUE' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.iou-welsh', name: 'IOU Welsh', symbol: 'WELSH' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.liquid-staked-charisma', name: 'Liquid Staked Charisma', symbol: 'LSCHA' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.lovely-coin', name: 'Lovely Coin', symbol: 'LOVELY' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.red-pill', name: 'Red Pill', symbol: 'REDPILL' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.roo-coin', name: 'Roo Coin', symbol: 'ROO' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.up-dog', name: 'Up Dog', symbol: 'UP' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-coin', name: 'Welsh Coin', symbol: 'WELSH' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.wrapped-bitcoin', name: 'Wrapped Bitcoin', symbol: 'xBTC' },
    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.wrapped-nothing', name: 'Wrapped Nothing', symbol: 'NOTHING' }
];

function normalizeString(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function calculateStringSimilarity(str1: string, str2: string): number {
    const norm1 = normalizeString(str1);
    const norm2 = normalizeString(str2);
    
    if (norm1 === norm2) return 100;
    if (norm1.includes(norm2) || norm2.includes(norm1)) return 85;
    
    // Levenshtein distance similarity
    const maxLen = Math.max(norm1.length, norm2.length);
    if (maxLen === 0) return 100;
    
    const distance = levenshteinDistance(norm1, norm2);
    return Math.max(0, (1 - distance / maxLen) * 100);
}

function levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
            const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + indicator
            );
        }
    }
    
    return matrix[str2.length][str1.length];
}

function findMatches(missingToken: any, existingTokens: TokenEntry[]): SimilarityMatch[] {
    const matches: SimilarityMatch[] = [];
    
    for (const existing of existingTokens) {
        if (!existing.hasRealImage) continue; // Only consider tokens with real images
        
        // Name similarity
        const nameSimilarity = existing.name ? calculateStringSimilarity(missingToken.name, existing.name) : 0;
        
        // Symbol similarity
        const symbolSimilarity = existing.symbol ? calculateStringSimilarity(missingToken.symbol, existing.symbol) : 0;
        
        // Contract name similarity (extract token name from contract)
        const missingContractName = missingToken.contractId.split('.')[1]?.replace(/-/g, ' ') || '';
        const existingContractName = existing.contractId.split('.')[1]?.replace(/-/g, ' ') || '';
        const contractSimilarity = calculateStringSimilarity(missingContractName, existingContractName);
        
        // Combined score with weights
        const combinedScore = (nameSimilarity * 0.4) + (symbolSimilarity * 0.4) + (contractSimilarity * 0.2);
        
        // Only include matches with reasonable similarity
        if (combinedScore > 30 || nameSimilarity > 60 || symbolSimilarity > 60 || contractSimilarity > 70) {
            let matchType: 'name' | 'symbol' | 'contract' | 'combined' = 'combined';
            let bestScore = combinedScore;
            
            if (nameSimilarity > bestScore) {
                matchType = 'name';
                bestScore = nameSimilarity;
            }
            if (symbolSimilarity > bestScore) {
                matchType = 'symbol';
                bestScore = symbolSimilarity;
            }
            if (contractSimilarity > bestScore) {
                matchType = 'contract';
                bestScore = contractSimilarity;
            }
            
            const confidence = bestScore > 80 ? 'high' : bestScore > 60 ? 'medium' : 'low';
            
            matches.push({
                targetToken: missingToken.contractId,
                candidateToken: existing,
                similarity: bestScore,
                matchType,
                confidence
            });
        }
    }
    
    return matches.sort((a, b) => b.similarity - a.similarity);
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
    
    return { hasReal: true, source: 'Real image' };
}

async function findSimilarTokenImages(): Promise<void> {
    console.log('🔍 FINDING SIMILAR TOKEN IMAGES');
    console.log('Searching for tokens with similar names/symbols that have real images...');
    console.log('');
    
    try {
        // Fetch all metadata entries
        const listUrl = 'https://metadata.charisma.rocks/api/v1/metadata/list';
        console.log('📥 Fetching all metadata entries...');
        
        const response = await fetch(listUrl, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            console.error(`❌ Failed to fetch metadata: ${response.status} ${response.statusText}`);
            return;
        }
        
        const result = await response.json();
        if (!result.success || !result.metadata) {
            console.error('❌ Invalid response from metadata service');
            return;
        }
        
        // Process existing tokens
        const existingTokens: TokenEntry[] = result.metadata.map((entry: any) => {
            const imageAnalysis = analyzeImageSource(entry.image || '');
            
            return {
                contractId: entry.contractId || 'Unknown',
                name: entry.name,
                symbol: entry.symbol,
                image: entry.image,
                hasRealImage: imageAnalysis.hasReal,
                imageSource: imageAnalysis.source
            };
        }).filter((token: TokenEntry) => token.hasRealImage); // Only tokens with real images
        
        console.log(`✅ Found ${existingTokens.length} tokens with real images to search through`);
        console.log('');
        
        // Find matches for each missing token
        const allMatches: SimilarityMatch[] = [];
        
        for (const missingToken of MISSING_TOKENS) {
            console.log(`🔎 Searching for matches for ${missingToken.name} (${missingToken.symbol})...`);
            
            const matches = findMatches(missingToken, existingTokens);
            allMatches.push(...matches);
            
            if (matches.length > 0) {
                console.log(`  Found ${matches.length} potential matches:`);
                matches.slice(0, 3).forEach((match, index) => {
                    console.log(`    ${index + 1}. ${match.candidateToken.name} (${match.candidateToken.symbol}) - ${match.similarity.toFixed(1)}% similarity (${match.matchType})`);
                });
            } else {
                console.log('  No similar tokens found');
            }
        }
        
        console.log('');
        console.log('📊 SIMILARITY ANALYSIS RESULTS');
        console.log('═'.repeat(80));
        
        const highConfidenceMatches = allMatches.filter(m => m.confidence === 'high');
        const mediumConfidenceMatches = allMatches.filter(m => m.confidence === 'medium');
        const lowConfidenceMatches = allMatches.filter(m => m.confidence === 'low');
        
        console.log(`High confidence matches (>80%): ${highConfidenceMatches.length}`);
        console.log(`Medium confidence matches (60-80%): ${mediumConfidenceMatches.length}`);
        console.log(`Low confidence matches (30-60%): ${lowConfidenceMatches.length}`);
        console.log('');
        
        if (highConfidenceMatches.length > 0) {
            console.log('🎯 HIGH CONFIDENCE MATCHES:');
            console.log('─'.repeat(80));
            
            highConfidenceMatches.forEach(match => {
                const missing = MISSING_TOKENS.find(t => t.contractId === match.targetToken);
                console.log(`✅ ${missing?.name} (${missing?.symbol})`);
                console.log(`   → ${match.candidateToken.name} (${match.candidateToken.symbol})`);
                console.log(`   Similarity: ${match.similarity.toFixed(1)}% (${match.matchType} match)`);
                console.log(`   Image: ${match.candidateToken.image}`);
                console.log(`   Contract: ${match.candidateToken.contractId}`);
                console.log('');
            });
        }
        
        if (mediumConfidenceMatches.length > 0) {
            console.log('⚠️  MEDIUM CONFIDENCE MATCHES:');
            console.log('─'.repeat(80));
            
            mediumConfidenceMatches.slice(0, 10).forEach(match => {
                const missing = MISSING_TOKENS.find(t => t.contractId === match.targetToken);
                console.log(`🟡 ${missing?.name} (${missing?.symbol})`);
                console.log(`   → ${match.candidateToken.name} (${match.candidateToken.symbol})`);
                console.log(`   Similarity: ${match.similarity.toFixed(1)}% (${match.matchType} match)`);
                console.log(`   Image: ${match.candidateToken.image}`);
                console.log('');
            });
            
            if (mediumConfidenceMatches.length > 10) {
                console.log(`   ... and ${mediumConfidenceMatches.length - 10} more medium confidence matches`);
            }
        }
        
        // Special analysis for specific tokens
        console.log('🔍 SPECIAL ANALYSIS:');
        console.log('─'.repeat(80));
        
        // Look for Charisma-related tokens
        const charismaTokens = existingTokens.filter(t => 
            t.name?.toLowerCase().includes('charisma') || 
            t.symbol?.toLowerCase().includes('cha') ||
            t.contractId.includes('charisma')
        );
        
        if (charismaTokens.length > 0) {
            console.log(`Found ${charismaTokens.length} Charisma-related tokens with images:`);
            charismaTokens.forEach(token => {
                console.log(`  • ${token.name} (${token.symbol}): ${token.image}`);
            });
            console.log('');
        }
        
        // Look for Welsh-related tokens
        const welshTokens = existingTokens.filter(t => 
            t.name?.toLowerCase().includes('welsh') || 
            t.symbol?.toLowerCase().includes('welsh') ||
            t.contractId.includes('welsh')
        );
        
        if (welshTokens.length > 0) {
            console.log(`Found ${welshTokens.length} Welsh-related tokens with images:`);
            welshTokens.forEach(token => {
                console.log(`  • ${token.name} (${token.symbol}): ${token.image}`);
            });
            console.log('');
        }
        
        // Look for tokens in the same contract address
        const sameContractTokens = existingTokens.filter(t => 
            t.contractId.startsWith('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.')
        );
        
        if (sameContractTokens.length > 0) {
            console.log(`Found ${sameContractTokens.length} tokens from the same contract address with images:`);
            sameContractTokens.slice(0, 10).forEach(token => {
                console.log(`  • ${token.name} (${token.symbol}): ${token.image}`);
            });
            if (sameContractTokens.length > 10) {
                console.log(`  ... and ${sameContractTokens.length - 10} more`);
            }
            console.log('');
        }
        
        console.log('🚀 RECOMMENDATIONS:');
        console.log('─'.repeat(80));
        
        if (highConfidenceMatches.length > 0) {
            console.log(`1. Review ${highConfidenceMatches.length} high-confidence matches - these may be the same tokens`);
            console.log('   with slightly different names or implementations');
        }
        
        if (sameContractTokens.length > 0) {
            console.log(`2. Check ${sameContractTokens.length} tokens from the same contract address`);
            console.log('   These may share visual themes or branding');
        }
        
        if (charismaTokens.length > 0) {
            console.log('3. Charisma-related tokens exist with real images');
            console.log('   These could provide templates for missing charisma tokens');
        }
        
        console.log('');
        console.log('Next steps:');
        console.log('• Manually review high-confidence matches to see if they\'re the same tokens');
        console.log('• Check if any images from the same contract address could be reused');
        console.log('• For tokens with no matches, create new appropriate images');
        
    } catch (error: any) {
        console.error('❌ Error searching for similar tokens:', error.message);
    }
}

// Run the search
findSimilarTokenImages().catch(console.error);