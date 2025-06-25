#!/usr/bin/env tsx
// Script to standardize totalSupply → total_supply in source code files

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

interface FileChange {
    file: string;
    changes: number;
    preview: string[];
}

interface ConversionResult {
    totalFiles: number;
    changedFiles: number;
    totalChanges: number;
    changes: FileChange[];
    errors: Array<{ file: string; error: string }>;
}

function standardizeTotalSupplyInContent(content: string, filePath: string): { content: string; changes: number; preview: string[] } {
    let changeCount = 0;
    const preview: string[] = [];
    const lines = content.split('\n');
    
    // Patterns to replace (be careful with context)
    const replacements = [
        // Interface/type definitions
        { pattern: /(\s+)totalSupply(\??):\s*/g, replacement: '$1total_supply$2: ', description: 'Interface property definition' },
        
        // Object property access
        { pattern: /\.totalSupply\b/g, replacement: '.total_supply', description: 'Property access' },
        
        // Object destructuring
        { pattern: /{\s*([^}]*?)totalSupply([^}]*?)}/g, replacement: (match: string, before: string, after: string) => {
            return `{ ${before}total_supply${after}}`;
        }, description: 'Object destructuring' },
        
        // Object literal properties
        { pattern: /(\s+)totalSupply:\s*([^,\n}]+)/g, replacement: '$1total_supply: $2', description: 'Object literal property' },
        
        // Variable assignments from totalSupply
        { pattern: /const\s+(\w+)\s*=\s*.*?\.totalSupply\b/g, replacement: (match: string) => match.replace('.totalSupply', '.total_supply'), description: 'Variable assignment' },
        
        // Function parameters named totalSupply (be more careful here)
        { pattern: /\(\s*([^)]*?)totalSupply([^)]*?)\)/g, replacement: (match: string, before: string, after: string) => {
            // Only replace if it looks like a parameter, not a property access
            if (before.includes('.') || after.includes('.')) return match;
            return `(${before}total_supply${after})`;
        }, description: 'Function parameter' }
    ];
    
    let newContent = content;
    
    replacements.forEach(({ pattern, replacement, description }) => {
        if (typeof replacement === 'string') {
            const matches = [...newContent.matchAll(pattern)];
            if (matches.length > 0) {
                newContent = newContent.replace(pattern, replacement);
                changeCount += matches.length;
                
                // Add preview
                matches.forEach(match => {
                    const lineNumber = newContent.substring(0, match.index).split('\n').length;
                    preview.push(`Line ${lineNumber}: ${description} - "${match[0]}"`);
                });
            }
        } else if (typeof replacement === 'function') {
            const matches = [...newContent.matchAll(pattern)];
            if (matches.length > 0) {
                newContent = newContent.replace(pattern, replacement);
                changeCount += matches.length;
                
                // Add preview
                matches.forEach(match => {
                    const lineNumber = newContent.substring(0, match.index).split('\n').length;
                    preview.push(`Line ${lineNumber}: ${description} - "${match[0]}"`);
                });
            }
        }
    });
    
    return { content: newContent, changes: changeCount, preview };
}

async function standardizeTotalSupplyFields(dryRun: boolean = true): Promise<ConversionResult> {
    console.log('🔧 STANDARDIZING TOTAL SUPPLY FIELD NAMES IN SOURCE CODE');
    console.log(`Mode: ${dryRun ? 'DRY RUN (simulation)' : 'LIVE (will modify files)'}`);
    console.log('Converting totalSupply → total_supply in TypeScript/JavaScript files...');
    console.log('');
    
    const result: ConversionResult = {
        totalFiles: 0,
        changedFiles: 0,
        totalChanges: 0,
        changes: [],
        errors: []
    };
    
    try {
        // Find TypeScript and JavaScript files, excluding scripts and node_modules
        const patterns = [
            '../../**/*.ts',
            '../../**/*.tsx', 
            '../../**/*.js',
            '../../**/*.jsx'
        ];
        
        const excludePatterns = [
            '**/node_modules/**',
            '**/scripts/**',
            '**/.next/**',
            '**/dist/**',
            '**/build/**'
        ];
        
        console.log('📥 Scanning for TypeScript/JavaScript files...');
        
        const allFiles: string[] = [];
        for (const pattern of patterns) {
            try {
                const files = await glob(pattern, { 
                    ignore: excludePatterns,
                    absolute: true 
                });
                allFiles.push(...files);
            } catch (globError) {
                console.warn(`Warning: Could not scan pattern ${pattern}:`, globError);
            }
        }
        
        // Remove duplicates
        const uniqueFiles = [...new Set(allFiles)];
        result.totalFiles = uniqueFiles.length;
        
        console.log(`✅ Found ${result.totalFiles} source files to analyze`);
        console.log('');
        
        // Process each file
        for (const filePath of uniqueFiles) {
            try {
                const content = readFileSync(filePath, 'utf-8');
                
                // Check if file contains totalSupply
                if (!content.includes('totalSupply')) {
                    continue;
                }
                
                const { content: newContent, changes, preview } = standardizeTotalSupplyInContent(content, filePath);
                
                if (changes > 0) {
                    console.log(`🔍 ${filePath.replace(process.cwd(), '.')}`);
                    console.log(`   Changes: ${changes}`);
                    preview.slice(0, 3).forEach(p => console.log(`   - ${p}`));
                    if (preview.length > 3) {
                        console.log(`   ... and ${preview.length - 3} more`);
                    }
                    console.log('');
                    
                    result.changes.push({
                        file: filePath,
                        changes,
                        preview
                    });
                    
                    result.totalChanges += changes;
                    result.changedFiles++;
                    
                    // Write file if not dry run
                    if (!dryRun) {
                        writeFileSync(filePath, newContent, 'utf-8');
                        console.log(`   ✅ Updated file`);
                    }
                }
                
            } catch (error: any) {
                console.error(`❌ Error processing ${filePath}:`, error.message);
                result.errors.push({
                    file: filePath,
                    error: error.message
                });
            }
        }
        
    } catch (error: any) {
        console.error('❌ Error during file standardization:', error.message);
        throw error;
    }
    
    return result;
}

async function main() {
    // Get command line arguments
    const mode = process.argv[2] || 'dry-run';
    const isLiveMode = mode === 'live';
    
    if (isLiveMode) {
        console.log('⚠️  LIVE MODE - This will modify source code files!');
        console.log('Press Ctrl+C to cancel if you want to review the plan first.');
        console.log('');
    }
    
    try {
        const result = await standardizeTotalSupplyFields(!isLiveMode);
        
        console.log('📊 STANDARDIZATION RESULTS');
        console.log('═'.repeat(80));
        console.log(`Total files scanned: ${result.totalFiles}`);
        console.log(`Files with changes: ${result.changedFiles}`);
        console.log(`Total replacements: ${result.totalChanges}`);
        console.log(`Errors encountered: ${result.errors.length}`);
        console.log('');
        
        if (result.changes.length > 0) {
            console.log('📝 SUMMARY OF CHANGES:');
            console.log('─'.repeat(80));
            
            result.changes.forEach(change => {
                console.log(`📄 ${change.file.replace(process.cwd(), '.')} (${change.changes} changes)`);
                change.preview.slice(0, 2).forEach(p => console.log(`   ${p}`));
                if (change.preview.length > 2) {
                    console.log(`   ... and ${change.preview.length - 2} more changes`);
                }
                console.log('');
            });
        }
        
        if (result.errors.length > 0) {
            console.log('❌ FILES WITH ERRORS:');
            console.log('─'.repeat(80));
            result.errors.forEach(error => {
                console.log(`• ${error.file}: ${error.error}`);
            });
            console.log('');
        }
        
        if (!isLiveMode && result.changedFiles > 0) {
            console.log('🔄 DRY RUN MODE - No files were modified');
            console.log('To apply these changes, run: pnpm script standardize-totalsupply-field-names live');
        } else if (isLiveMode && result.changedFiles > 0) {
            console.log('🎉 SUCCESS!');
            console.log(`Standardized totalSupply → total_supply in ${result.changedFiles} files!`);
            console.log('');
            console.log('Next steps:');
            console.log('1. Run tests to ensure no functionality was broken');
            console.log('2. Commit the changes');
            console.log('3. The codebase now uses consistent "total_supply" naming');
        } else {
            console.log('✅ No totalSupply fields found in source code - already standardized!');
        }
        
    } catch (error: any) {
        console.error('❌ Standardization failed:', error.message);
        process.exit(1);
    }
}

// Run the standardization
main().catch(console.error);