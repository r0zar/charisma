#!/usr/bin/env tsx

/**
 * Test the improved image logic with different scenarios
 */

// Mock the functions we need
function normalizeImageUrl(url: string | null | undefined): string {
    if (!url) return '';
    return url.trim().toLowerCase();
}

function isPlaceholderImage(url: string | null | undefined): boolean {
    if (!url) return true;
    const normalized = normalizeImageUrl(url);
    return normalized.includes('ui-avatars.com') || 
           normalized.includes('placeholder') ||
           normalized === '';
}

function generatePlaceholderImage(symbol: string): string {
    const cleanSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const displaySymbol = cleanSymbol || 'TOKEN';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displaySymbol)}&size=200&background=6366f1&color=ffffff&format=png&bold=true`;
}

function testImageLogic(
    currentImage: string | null | undefined,
    freshImage: string | null | undefined,
    freshSymbol: string,
    scenario: string
) {
    console.log(`\n🧪 ${scenario}`);
    console.log(`  Current: ${currentImage || 'null'}`);
    console.log(`  Fresh: ${freshImage || 'null'}`);
    console.log(`  Symbol: ${freshSymbol}`);
    
    const currentIsPlaceholder = isPlaceholderImage(currentImage);
    const freshIsPlaceholder = isPlaceholderImage(freshImage);
    
    let newImage = currentImage; // Default to keeping current image
    let shouldChange = false;
    let reason = '';
    
    if (!currentImage && !freshImage) {
        // Neither cache nor fresh has image - generate placeholder using fresh symbol
        newImage = generatePlaceholderImage(freshSymbol);
        shouldChange = true;
        reason = 'Generated placeholder (no images found)';
    } else if (!currentImage && freshImage) {
        // Cache has no image but fresh has one - use fresh image
        newImage = freshImage;
        shouldChange = true;
        reason = 'Added fresh image (cache had none)';
    } else if (currentImage && !freshImage) {
        // Cache has image but fresh doesn't - keep current, but check if we can improve placeholder
        if (currentIsPlaceholder) {
            const improvedPlaceholder = generatePlaceholderImage(freshSymbol);
            if (normalizeImageUrl(currentImage) !== normalizeImageUrl(improvedPlaceholder)) {
                newImage = improvedPlaceholder;
                shouldChange = true;
                reason = 'Improved placeholder with better symbol (no fresh image)';
            } else {
                reason = 'Placeholder already optimal (no fresh image)';
            }
        } else {
            reason = 'Kept real image (no downgrade)';
        }
    } else if (currentImage && freshImage && normalizeImageUrl(currentImage) !== normalizeImageUrl(freshImage)) {
        // Both have images but they're different
        if (currentIsPlaceholder && !freshIsPlaceholder) {
            // Upgrade from placeholder to real image
            newImage = freshImage;
            shouldChange = true;
            reason = 'Upgraded placeholder to real image';
        } else if (!currentIsPlaceholder && freshIsPlaceholder) {
            // Don't downgrade from real image to placeholder
            reason = 'Kept real image (no downgrade to placeholder)';
        } else if (currentIsPlaceholder && freshIsPlaceholder) {
            // Both are placeholders, use fresh one (might have better symbol)
            newImage = freshImage;
            shouldChange = true;
            reason = 'Updated placeholder with fresh symbol';
        } else {
            // Both are real images, prefer fresh one
            newImage = freshImage;
            shouldChange = true;
            reason = 'Updated to fresh real image';
        }
    } else if (currentIsPlaceholder && currentImage) {
        // Current is placeholder, check if we can improve it with better symbol
        const improvedPlaceholder = generatePlaceholderImage(freshSymbol);
        if (normalizeImageUrl(currentImage) !== normalizeImageUrl(improvedPlaceholder)) {
            newImage = improvedPlaceholder;
            shouldChange = true;
            reason = 'Improved placeholder with better symbol';
        } else {
            reason = 'Placeholder already optimal';
        }
    } else {
        reason = 'No change needed';
    }
    
    console.log(`  Result: ${shouldChange ? '✅ CHANGE' : '⏸️  NO CHANGE'} - ${reason}`);
    if (shouldChange) {
        console.log(`  New: ${newImage}`);
    }
}

function runImageLogicTests() {
    console.log('🔍 Testing Image Logic Scenarios\n');
    
    // Test cases
    testImageLogic(
        null,
        null,
        'CHA',
        'No image anywhere - should generate placeholder'
    );
    
    testImageLogic(
        null,
        'https://charisma.rocks/logo.png',
        'CHA',
        'No cache image, fresh has real image - should use fresh'
    );
    
    testImageLogic(
        'https://charisma.rocks/logo.png',
        null,
        'CHA',
        'Cache has real image, fresh has none - should keep cache'
    );
    
    testImageLogic(
        'https://ui-avatars.com/api/?name=CHA&size=200',
        'https://charisma.rocks/logo.png',
        'CHA',
        'Cache has placeholder, fresh has real - should upgrade'
    );
    
    testImageLogic(
        'https://charisma.rocks/logo.png',
        'https://ui-avatars.com/api/?name=CHA&size=200',
        'CHA',
        'Cache has real, fresh has placeholder - should keep real'
    );
    
    testImageLogic(
        'https://ui-avatars.com/api/?name=TOKEN&size=200',
        'https://ui-avatars.com/api/?name=CHA&size=200',
        'CHA',
        'Both placeholders, fresh has better symbol - should update'
    );
    
    testImageLogic(
        'https://charisma.rocks/old-logo.png',
        'https://charisma.rocks/new-logo.png',
        'CHA',
        'Both real images, different URLs - should update to fresh'
    );
    
    testImageLogic(
        'https://ui-avatars.com/api/?name=CHA&size=200',
        null,
        'CHA',
        'Cache has placeholder, check if symbol improved - should not change'
    );
    
    testImageLogic(
        'https://ui-avatars.com/api/?name=TOKEN&size=200',
        null,
        'CHARISMA',
        'Cache has generic placeholder, better symbol available - should improve'
    );
}

runImageLogicTests();