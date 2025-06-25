// Audit token metadata completeness across the ecosystem
import { fetchMetadata, listTokens, getTokenMetadataCached } from '@repo/tokens';

interface MetadataAuditResult {
    contractId: string;
    name?: string;
    symbol?: string;
    description?: string | null;
    image?: string | null;
    decimals?: number;
    identifier?: string;
    total_supply?: string | number | null;
    issues: string[];
    severity: 'critical' | 'warning' | 'info';
    score: number; // 0-100, 100 being perfect
}

interface AuditSummary {
    totalTokens: number;
    tokensWithCriticalIssues: number;
    tokensWithWarnings: number;
    tokensWithInfo: number;
    perfectTokens: number;
    averageScore: number;
    missingDescriptions: number;
    missingImages: number;
    missingIdentifiers: number;
    emptyNames: number;
    emptySymbols: number;
}

const SEVERITY_WEIGHTS = {
    critical: 30,
    warning: 10,
    info: 2
};

function auditTokenMetadata(token: any): MetadataAuditResult {
    const issues: string[] = [];
    let severity: 'critical' | 'warning' | 'info' = 'info';
    let score = 100;

    // Critical issues (major functionality problems)
    if (!token.name || token.name.trim() === '') {
        issues.push('Missing or empty token name');
        severity = 'critical';
        score -= SEVERITY_WEIGHTS.critical;
    }

    if (!token.symbol || token.symbol.trim() === '') {
        issues.push('Missing or empty token symbol');
        severity = 'critical';
        score -= SEVERITY_WEIGHTS.critical;
    }

    if (!token.identifier || token.identifier.trim() === '') {
        issues.push('Missing or empty token identifier');
        severity = 'critical';
        score -= SEVERITY_WEIGHTS.critical;
    }

    if (token.decimals === undefined || token.decimals === null) {
        issues.push('Missing decimals value');
        severity = 'critical';
        score -= SEVERITY_WEIGHTS.critical;
    }

    // Warning issues (incomplete metadata)
    if (!token.description || token.description.trim() === '') {
        issues.push('Missing or empty description');
        if (severity !== 'critical') severity = 'warning';
        score -= SEVERITY_WEIGHTS.warning;
    }

    if (!token.image || token.image.trim() === '') {
        issues.push('Missing or empty image URL');
        if (severity !== 'critical') severity = 'warning';
        score -= SEVERITY_WEIGHTS.warning;
    }

    // Info issues (nice to have)
    if (!token.total_supply && token.total_supply !== 0) {
        issues.push('Missing total supply information');
        score -= SEVERITY_WEIGHTS.info;
    }

    if (token.image && !isValidImageUrl(token.image)) {
        issues.push('Image URL appears to be invalid or placeholder');
        if (severity !== 'critical' && severity !== 'warning') severity = 'info';
        score -= SEVERITY_WEIGHTS.info;
    }

    if (token.description && token.description.length < 20) {
        issues.push('Description is very short (less than 20 characters)');
        score -= SEVERITY_WEIGHTS.info;
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    return {
        contractId: token.contractId,
        name: token.name,
        symbol: token.symbol,
        description: token.description,
        image: token.image,
        decimals: token.decimals,
        identifier: token.identifier,
        total_supply: token.total_supply,
        issues,
        severity: issues.length === 0 ? 'info' : severity,
        score
    };
}

function isValidImageUrl(url: string): boolean {
    // Check for common placeholder patterns
    const placeholderPatterns = [
        /placehold\.co/i,
        /placeholder/i,
        /ui-avatars\.com/i,
        /\?text=/i
    ];

    for (const pattern of placeholderPatterns) {
        if (pattern.test(url)) {
            return false;
        }
    }

    // Check if it's a valid URL format
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
        return false;
    }
}

function generateAuditSummary(auditResults: MetadataAuditResult[]): AuditSummary {
    const summary: AuditSummary = {
        totalTokens: auditResults.length,
        tokensWithCriticalIssues: 0,
        tokensWithWarnings: 0,
        tokensWithInfo: 0,
        perfectTokens: 0,
        averageScore: 0,
        missingDescriptions: 0,
        missingImages: 0,
        missingIdentifiers: 0,
        emptyNames: 0,
        emptySymbols: 0
    };

    let totalScore = 0;

    for (const result of auditResults) {
        totalScore += result.score;

        if (result.score === 100 && result.issues.length === 0) {
            summary.perfectTokens++;
        }

        switch (result.severity) {
            case 'critical':
                summary.tokensWithCriticalIssues++;
                break;
            case 'warning':
                summary.tokensWithWarnings++;
                break;
            case 'info':
                summary.tokensWithInfo++;
                break;
        }

        // Count specific issues
        if (!result.description || result.description.trim() === '') {
            summary.missingDescriptions++;
        }
        if (!result.image || result.image.trim() === '') {
            summary.missingImages++;
        }
        if (!result.identifier || result.identifier.trim() === '') {
            summary.missingIdentifiers++;
        }
        if (!result.name || result.name.trim() === '') {
            summary.emptyNames++;
        }
        if (!result.symbol || result.symbol.trim() === '') {
            summary.emptySymbols++;
        }
    }

    summary.averageScore = auditResults.length > 0 ? totalScore / auditResults.length : 0;

    return summary;
}

function printAuditResults(auditResults: MetadataAuditResult[], summary: AuditSummary) {
    console.log('\n📊 TOKEN METADATA AUDIT SUMMARY');
    console.log('═'.repeat(50));
    console.log(`Total tokens analyzed: ${summary.totalTokens}`);
    console.log(`Average metadata score: ${summary.averageScore.toFixed(1)}/100`);
    console.log('');

    console.log('🚨 Issues by severity:');
    console.log(`  Critical issues: ${summary.tokensWithCriticalIssues} tokens`);
    console.log(`  Warnings: ${summary.tokensWithWarnings} tokens`);
    console.log(`  Info/Minor: ${summary.tokensWithInfo} tokens`);
    console.log(`  Perfect tokens: ${summary.perfectTokens} tokens`);
    console.log('');

    console.log('🔍 Missing field analysis:');
    console.log(`  Missing descriptions: ${summary.missingDescriptions} tokens`);
    console.log(`  Missing images: ${summary.missingImages} tokens`);
    console.log(`  Missing identifiers: ${summary.missingIdentifiers} tokens`);
    console.log(`  Empty names: ${summary.emptyNames} tokens`);
    console.log(`  Empty symbols: ${summary.emptySymbols} tokens`);
    console.log('');

    // Show critical issues first
    const criticalTokens = auditResults.filter(r => r.severity === 'critical');
    if (criticalTokens.length > 0) {
        console.log('🚨 CRITICAL ISSUES (require immediate attention):');
        console.log('─'.repeat(50));
        criticalTokens.forEach(token => {
            console.log(`${token.contractId} (Score: ${token.score}/100)`);
            console.log(`  Name: "${token.name || 'MISSING'}" | Symbol: "${token.symbol || 'MISSING'}"`);
            token.issues.forEach(issue => console.log(`  ❌ ${issue}`));
            console.log('');
        });
    }

    // Show warnings
    const warningTokens = auditResults.filter(r => r.severity === 'warning');
    if (warningTokens.length > 0) {
        console.log('⚠️  WARNING ISSUES (incomplete metadata):');
        console.log('─'.repeat(50));
        warningTokens.slice(0, 10).forEach(token => { // Show first 10
            console.log(`${token.contractId} (Score: ${token.score}/100)`);
            console.log(`  Name: "${token.name}" | Symbol: "${token.symbol}"`);
            token.issues.forEach(issue => console.log(`  ⚠️  ${issue}`));
            console.log('');
        });
        if (warningTokens.length > 10) {
            console.log(`... and ${warningTokens.length - 10} more tokens with warnings`);
        }
        console.log('');
    }

    // Show perfect tokens
    const perfectTokens = auditResults.filter(r => r.score === 100);
    if (perfectTokens.length > 0) {
        console.log('✅ PERFECT TOKENS (complete metadata):');
        console.log('─'.repeat(50));
        perfectTokens.slice(0, 5).forEach(token => {
            console.log(`${token.contractId} - ${token.name} (${token.symbol})`);
        });
        if (perfectTokens.length > 5) {
            console.log(`... and ${perfectTokens.length - 5} more perfect tokens`);
        }
        console.log('');
    }
}

async function runTokenMetadataAudit() {
    console.log('🔍 Starting Token Metadata Audit');
    console.log('');
    
    console.log('🔧 Environment Check:');
    console.log(`  TOKEN_CACHE_URL: ${process.env.TOKEN_CACHE_URL || process.env.NEXT_PUBLIC_TOKEN_CACHE_URL || 'https://tokens.charisma.rocks'}`);
    console.log('');

    try {
        console.log('📥 Fetching all tokens from token-cache...');
        const tokens = await listTokens();
        console.log(`Found ${tokens.length} tokens to audit`);
        console.log('');

        if (tokens.length === 0) {
            console.log('❌ No tokens found. Check your TOKEN_CACHE_URL configuration.');
            return;
        }

        console.log('🔍 Analyzing token metadata...');
        const auditResults: MetadataAuditResult[] = [];

        for (const token of tokens) {
            const result = auditTokenMetadata(token);
            auditResults.push(result);
        }

        // Sort by severity (critical first) then by score (lowest first)
        auditResults.sort((a, b) => {
            const severityOrder = { critical: 0, warning: 1, info: 2 };
            if (a.severity !== b.severity) {
                return severityOrder[a.severity] - severityOrder[b.severity];
            }
            return a.score - b.score;
        });

        const summary = generateAuditSummary(auditResults);
        printAuditResults(auditResults, summary);

        // Export detailed results to file
        const detailedResults = {
            summary,
            auditResults,
            generatedAt: new Date().toISOString()
        };

        console.log('💾 Audit complete!');
        console.log('');
        console.log('🎯 RECOMMENDATIONS:');
        console.log('1. Address critical issues first (missing names, symbols, identifiers)');
        console.log('2. Add descriptions and images for better user experience');
        console.log('3. Verify total supply data is accurate');
        console.log('4. Consider using the metadata API to provide fallback data');
        
    } catch (error: any) {
        console.error('❌ Error during token metadata audit:', error.message);
        if (error.message.includes('fetch')) {
            console.log('💡 This might be a network issue or TOKEN_CACHE_URL configuration problem');
        }
    }
}

runTokenMetadataAudit();