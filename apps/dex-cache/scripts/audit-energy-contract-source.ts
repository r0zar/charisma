// Audit energy contract source code for security issues, best practices, and potential improvements
import { getContractInfo } from '@repo/polyglot';
import { getAllVaultData } from '../src/lib/pool-service';

interface SecurityCheck {
    type: 'error' | 'warning' | 'info';
    category: 'security' | 'gas-optimization' | 'best-practice' | 'clarity-version' | 'function-design';
    title: string;
    description: string;
    recommendation?: string;
    lineContext?: string;
    riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

interface ContractAudit {
    contractId: string;
    contractName: string;
    sourceCodeLength: number;
    clarityVersion: number;
    blockHeight: number;
    checks: SecurityCheck[];
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        overallRisk: 'critical' | 'high' | 'medium' | 'low';
    };
}

async function auditEnergyContractSource() {
    console.log('🔍 Auditing Energy Contract Source Code');
    console.log('');

    try {
        // Get energy contracts
        console.log('📊 Fetching energy contracts...');
        const energyVaults = await getAllVaultData({ type: 'ENERGY' });
        
        if (energyVaults.length === 0) {
            console.log('❌ No energy contracts found');
            return;
        }

        console.log(`📋 Found ${energyVaults.length} energy contracts to audit`);
        console.log('');

        const auditResults: ContractAudit[] = [];

        // Known energy contracts to audit
        const contractsToAudit = [
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energize-v1',
            'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn'
        ];

        for (const contractId of contractsToAudit) {
            console.log(`🔬 Auditing contract: ${contractId}`);
            
            try {
                const contractInfo = await getContractInfo(contractId);
                if (!contractInfo) {
                    console.log(`  ❌ Contract not found: ${contractId}`);
                    continue;
                }

                const audit: ContractAudit = {
                    contractId,
                    contractName: contractId.split('.')[1],
                    sourceCodeLength: contractInfo.source_code.length,
                    clarityVersion: contractInfo.clarity_version,
                    blockHeight: contractInfo.block_height,
                    checks: [],
                    summary: {
                        critical: 0,
                        high: 0,
                        medium: 0,
                        low: 0,
                        overallRisk: 'low'
                    }
                };

                console.log(`  📄 Source code: ${audit.sourceCodeLength} characters`);
                console.log(`  🏗️ Clarity version: ${audit.clarityVersion}`);
                console.log(`  📦 Block height: ${audit.blockHeight}`);

                // Perform security checks
                audit.checks = await performSecurityChecks(contractInfo.source_code, contractId);
                
                // Calculate summary
                audit.summary = calculateAuditSummary(audit.checks);
                
                console.log(`  🎯 Security checks: ${audit.checks.length} issues found`);
                console.log(`  ⚠️ Risk level: ${audit.summary.overallRisk}`);
                console.log('');

                auditResults.push(audit);

            } catch (error) {
                console.log(`  ❌ Error auditing contract: ${error}`);
            }
        }

        // Generate comprehensive audit report
        generateAuditReport(auditResults);

    } catch (error) {
        console.error('❌ Error during contract audit:', error);
        process.exit(1);
    }
}

async function performSecurityChecks(sourceCode: string, contractId: string): Promise<SecurityCheck[]> {
    const checks: SecurityCheck[] = [];

    // 1. Check for common security patterns
    checks.push(...checkSecurityPatterns(sourceCode));
    
    // 2. Check for gas optimization opportunities
    checks.push(...checkGasOptimization(sourceCode));
    
    // 3. Check for Clarity best practices
    checks.push(...checkBestPractices(sourceCode));
    
    // 4. Check function design patterns
    checks.push(...checkFunctionDesign(sourceCode));
    
    // 5. Check for energy-specific patterns
    checks.push(...checkEnergySpecificPatterns(sourceCode, contractId));

    return checks;
}

function checkSecurityPatterns(sourceCode: string): SecurityCheck[] {
    const checks: SecurityCheck[] = [];

    // Check for proper error handling
    const errorPatterns = sourceCode.match(/\(err\s+u\d+\)/g);
    if (!errorPatterns || errorPatterns.length < 2) {
        checks.push({
            type: 'warning',
            category: 'security',
            title: 'Limited Error Handling',
            description: 'Contract has limited error handling patterns',
            recommendation: 'Consider adding more specific error codes for different failure scenarios',
            riskLevel: 'medium'
        });
    }

    // Check for tx-sender usage
    const txSenderUsage = sourceCode.match(/tx-sender/g);
    if (txSenderUsage && txSenderUsage.length > 5) {
        checks.push({
            type: 'info',
            category: 'security',
            title: 'High tx-sender Usage',
            description: `tx-sender is used ${txSenderUsage.length} times`,
            recommendation: 'Review tx-sender usage to ensure proper authorization checks',
            riskLevel: 'low'
        });
    }

    // Check for contract-call patterns
    const contractCalls = sourceCode.match(/contract-call\?/g);
    if (contractCalls && contractCalls.length > 0) {
        checks.push({
            type: 'info',
            category: 'security',
            title: 'External Contract Calls',
            description: `Contract makes ${contractCalls.length} external contract call(s)`,
            recommendation: 'Ensure external contracts are trusted and handle call failures properly',
            riskLevel: 'medium'
        });
    }

    // Check for proper access control
    if (!sourceCode.includes('tx-sender') && !sourceCode.includes('contract-caller')) {
        checks.push({
            type: 'warning',
            category: 'security',
            title: 'No Access Control',
            description: 'Contract does not appear to have access control mechanisms',
            recommendation: 'Consider implementing proper access control for sensitive functions',
            riskLevel: 'high'
        });
    }

    return checks;
}

function checkGasOptimization(sourceCode: string): SecurityCheck[] {
    const checks: SecurityCheck[] = [];

    // Check for redundant operations
    const redundantChecks = sourceCode.match(/\(is-eq\s+\w+\s+\w+\)/g);
    if (redundantChecks && redundantChecks.length > 10) {
        checks.push({
            type: 'info',
            category: 'gas-optimization',
            title: 'Multiple Equality Checks',
            description: `Found ${redundantChecks.length} equality checks`,
            recommendation: 'Consider consolidating redundant equality checks',
            riskLevel: 'low'
        });
    }

    // Check for large constants
    const largeConstants = sourceCode.match(/u\d{6,}/g);
    if (largeConstants && largeConstants.length > 0) {
        checks.push({
            type: 'info',
            category: 'gas-optimization',
            title: 'Large Constants',
            description: `Found ${largeConstants.length} large numeric constants`,
            recommendation: 'Consider if large constants can be computed or reduced',
            riskLevel: 'low'
        });
    }

    return checks;
}

function checkBestPractices(sourceCode: string): SecurityCheck[] {
    const checks: SecurityCheck[] = [];

    // Check for descriptive variable names
    const singleCharVars = sourceCode.match(/\(\w\s/g);
    if (singleCharVars && singleCharVars.length > 3) {
        checks.push({
            type: 'info',
            category: 'best-practice',
            title: 'Single Character Variables',
            description: 'Contract uses single character variable names',
            recommendation: 'Use more descriptive variable names for better readability',
            riskLevel: 'low'
        });
    }

    // Check for function documentation
    const functionCount = (sourceCode.match(/define-public|define-private|define-read-only/g) || []).length;
    const commentCount = (sourceCode.match(/;;/g) || []).length;
    
    if (functionCount > 3 && commentCount < functionCount) {
        checks.push({
            type: 'info',
            category: 'best-practice',
            title: 'Limited Documentation',
            description: `${functionCount} functions with only ${commentCount} comments`,
            recommendation: 'Add more inline documentation for complex functions',
            riskLevel: 'low'
        });
    }

    // Check for magic numbers
    const magicNumbers = sourceCode.match(/u\d+(?!.*define-constant)/g);
    if (magicNumbers && magicNumbers.length > 5) {
        checks.push({
            type: 'info',
            category: 'best-practice',
            title: 'Magic Numbers',
            description: `Found ${magicNumbers.length} potential magic numbers`,
            recommendation: 'Consider defining constants for repeated numeric values',
            riskLevel: 'low'
        });
    }

    return checks;
}

function checkFunctionDesign(sourceCode: string): SecurityCheck[] {
    const checks: SecurityCheck[] = [];

    // Check for complex functions
    const functions = sourceCode.split(/define-(?:public|private|read-only)/);
    let complexFunctions = 0;
    
    functions.forEach((func, index) => {
        if (index === 0) return; // Skip first split
        
        const lineCount = func.split('\n').length;
        const parenCount = (func.match(/\(/g) || []).length;
        
        if (lineCount > 20 || parenCount > 30) {
            complexFunctions++;
        }
    });

    if (complexFunctions > 0) {
        checks.push({
            type: 'info',
            category: 'function-design',
            title: 'Complex Functions',
            description: `${complexFunctions} function(s) appear complex`,
            recommendation: 'Consider breaking down complex functions into smaller, more focused functions',
            riskLevel: 'low'
        });
    }

    // Check for read-only vs public balance
    const readOnlyCount = (sourceCode.match(/define-read-only/g) || []).length;
    const publicCount = (sourceCode.match(/define-public/g) || []).length;
    
    if (publicCount > readOnlyCount * 2) {
        checks.push({
            type: 'info',
            category: 'function-design',
            title: 'High Public Function Ratio',
            description: `${publicCount} public vs ${readOnlyCount} read-only functions`,
            recommendation: 'Consider if some public functions could be read-only',
            riskLevel: 'low'
        });
    }

    return checks;
}

function checkEnergySpecificPatterns(sourceCode: string, contractId: string): SecurityCheck[] {
    const checks: SecurityCheck[] = [];

    // Check for energy-specific security patterns
    if (contractId.includes('energize')) {
        // Check for proper harvest energy implementation
        if (sourceCode.includes('harvest-energy') && !sourceCode.includes('OP_HARVEST_ENERGY')) {
            checks.push({
                type: 'warning',
                category: 'security',
                title: 'Missing Opcode Validation',
                description: 'harvest-energy function may lack proper opcode validation',
                recommendation: 'Ensure harvest operations validate the correct opcode',
                riskLevel: 'medium'
            });
        }

        // Check for quote function implementation
        if (!sourceCode.includes('quote')) {
            checks.push({
                type: 'error',
                category: 'function-design',
                title: 'Missing Quote Function',
                description: 'Energize contract should implement a quote function',
                recommendation: 'Implement quote function for price discovery',
                riskLevel: 'high'
            });
        }

        // Check for trait implementation
        if (!sourceCode.includes('impl-trait')) {
            checks.push({
                type: 'warning',
                category: 'best-practice',
                title: 'No Trait Implementation',
                description: 'Energize contract does not implement any traits',
                recommendation: 'Consider implementing liquidity-pool-trait for standardization',
                riskLevel: 'medium'
            });
        }
    }

    if (contractId.includes('hold-to-earn')) {
        // Check for tap function security
        if (sourceCode.includes('tap') && !sourceCode.includes('get-last-tap-block')) {
            checks.push({
                type: 'warning',
                category: 'security',
                title: 'Missing Tap Timing Check',
                description: 'tap function may lack proper timing validation',
                recommendation: 'Implement get-last-tap-block for tap frequency control',
                riskLevel: 'medium'
            });
        }

        // Check for balance integral calculations
        if (sourceCode.includes('calculate-balance-integral') && !sourceCode.includes('trapezoid')) {
            checks.push({
                type: 'info',
                category: 'function-design',
                title: 'Complex Integral Calculation',
                description: 'Balance integral calculation uses complex mathematical operations',
                recommendation: 'Ensure mathematical precision is maintained for large values',
                riskLevel: 'low'
            });
        }
    }

    return checks;
}

function calculateAuditSummary(checks: SecurityCheck[]): ContractAudit['summary'] {
    const summary = {
        critical: checks.filter(c => c.riskLevel === 'critical').length,
        high: checks.filter(c => c.riskLevel === 'high').length,
        medium: checks.filter(c => c.riskLevel === 'medium').length,
        low: checks.filter(c => c.riskLevel === 'low').length,
        overallRisk: 'low' as const
    };

    // Determine overall risk
    if (summary.critical > 0) {
        summary.overallRisk = 'critical';
    } else if (summary.high > 0) {
        summary.overallRisk = 'high';
    } else if (summary.medium > 2) {
        summary.overallRisk = 'high';
    } else if (summary.medium > 0) {
        summary.overallRisk = 'medium';
    }

    return summary;
}

function generateAuditReport(auditResults: ContractAudit[]) {
    console.log('📊 ENERGY CONTRACT SECURITY AUDIT REPORT');
    console.log(''.padEnd(60, '='));
    console.log('');

    const totalContracts = auditResults.length;
    const totalIssues = auditResults.reduce((sum, audit) => sum + audit.checks.length, 0);

    console.log('📈 Audit Summary:');
    console.log(`  Contracts audited: ${totalContracts}`);
    console.log(`  Total issues found: ${totalIssues}`);
    console.log('');

    // Risk distribution
    const riskDistribution = auditResults.reduce((acc, audit) => {
        acc[audit.summary.overallRisk] = (acc[audit.summary.overallRisk] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    console.log('🎯 Risk Distribution:');
    Object.entries(riskDistribution).forEach(([risk, count]) => {
        const icon = risk === 'critical' ? '🔴' : risk === 'high' ? '🟠' : risk === 'medium' ? '🟡' : '🟢';
        console.log(`  ${icon} ${risk}: ${count} contract(s)`);
    });
    console.log('');

    // Detailed contract reports
    auditResults.forEach(audit => {
        const riskIcon = audit.summary.overallRisk === 'critical' ? '🔴' : 
                        audit.summary.overallRisk === 'high' ? '🟠' : 
                        audit.summary.overallRisk === 'medium' ? '🟡' : '🟢';

        console.log(`${riskIcon} Contract: ${audit.contractId}`);
        console.log(`   Name: ${audit.contractName}`);
        console.log(`   Source: ${audit.sourceCodeLength} chars, Clarity v${audit.clarityVersion}`);
        console.log(`   Issues: ${audit.checks.length} total`);
        console.log(`   Risk breakdown: ${audit.summary.critical} critical, ${audit.summary.high} high, ${audit.summary.medium} medium, ${audit.summary.low} low`);
        console.log('');

        // Show high/critical issues
        const criticalIssues = audit.checks.filter(c => c.riskLevel === 'critical' || c.riskLevel === 'high');
        if (criticalIssues.length > 0) {
            console.log('   🚨 Critical/High Risk Issues:');
            criticalIssues.forEach(issue => {
                const issueIcon = issue.riskLevel === 'critical' ? '🔴' : '🟠';
                console.log(`     ${issueIcon} ${issue.title}`);
                console.log(`        ${issue.description}`);
                if (issue.recommendation) {
                    console.log(`        💡 ${issue.recommendation}`);
                }
            });
            console.log('');
        }

        // Show medium risk issues (limited)
        const mediumIssues = audit.checks.filter(c => c.riskLevel === 'medium').slice(0, 3);
        if (mediumIssues.length > 0) {
            console.log('   ⚠️ Medium Risk Issues (top 3):');
            mediumIssues.forEach(issue => {
                console.log(`     🟡 ${issue.title}: ${issue.description}`);
            });
            if (audit.checks.filter(c => c.riskLevel === 'medium').length > 3) {
                console.log(`     ... and ${audit.checks.filter(c => c.riskLevel === 'medium').length - 3} more medium issues`);
            }
            console.log('');
        }
    });

    // Category analysis
    console.log('📊 Issue Categories:');
    const categoryCount = auditResults.flatMap(a => a.checks).reduce((acc, check) => {
        acc[check.category] = (acc[check.category] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    Object.entries(categoryCount).forEach(([category, count]) => {
        console.log(`  ${category}: ${count} issues`);
    });
    console.log('');

    // Recommendations
    console.log('💡 Key Recommendations:');
    
    const highRiskContracts = auditResults.filter(a => a.summary.overallRisk === 'high' || a.summary.overallRisk === 'critical');
    if (highRiskContracts.length > 0) {
        console.log(`  🔴 Immediate attention needed for ${highRiskContracts.length} high-risk contract(s)`);
    }

    const securityIssues = auditResults.flatMap(a => a.checks).filter(c => c.category === 'security');
    if (securityIssues.length > 0) {
        console.log(`  🛡️ Review ${securityIssues.length} security-related issues`);
    }

    const gasIssues = auditResults.flatMap(a => a.checks).filter(c => c.category === 'gas-optimization');
    if (gasIssues.length > 0) {
        console.log(`  ⛽ Consider ${gasIssues.length} gas optimization opportunities`);
    }

    console.log('');
    console.log('✨ Energy contract security audit complete!');
}

// Run the audit
auditEnergyContractSource().catch(console.error);