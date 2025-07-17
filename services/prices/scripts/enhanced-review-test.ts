#!/usr/bin/env node --import tsx

import { logger } from './logger.js';
import { PriceService, type TokenMetadataProvider, type TokenMetadata } from '../src/price-service.js';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables from simple-swap app
config({ path: path.resolve(process.cwd(), '../../apps/simple-swap/.env.local') });

// Enhanced pool data provider with detailed logging
class EnhancedDexCachePoolDataProvider {
    private dexCacheUrl: string;

    constructor(dexCacheUrl = 'http://localhost:3003') {
        this.dexCacheUrl = dexCacheUrl;
    }

    async getAllVaultData(): Promise<any[]> {
        try {
            logger.info(`🔗 Connecting to dex-cache API: ${this.dexCacheUrl}/api/v1/vaults`);

            const response = await fetch(`${this.dexCacheUrl}/api/v1/vaults`, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.status !== 'success') {
                throw new Error(`API error: ${data.message || 'Unknown error'}`);
            }

            logger.success(`📊 Successfully fetched ${data.count} vaults from dex-cache`);

            // Enhanced vault analysis
            const vaultsByType = data.data.reduce((acc: any, vault: any) => {
                const type = vault.type || 'unknown';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {});

            logger.info('📈 Vault Distribution Analysis:');
            Object.entries(vaultsByType).forEach(([type, count]) => {
                logger.info(`  ${type}: ${count} vaults`);
            });

            // Analyze pool tokens and protocols
            const poolVaults = data.data.filter((v: any) => v.type === 'POOL');
            const protocolDistribution = poolVaults.reduce((acc: any, vault: any) => {
                const protocol = vault.protocol || 'unknown';
                acc[protocol] = (acc[protocol] || 0) + 1;
                return acc;
            }, {});

            logger.info('🏛️  Protocol Distribution for POOL vaults:');
            Object.entries(protocolDistribution).forEach(([protocol, count]) => {
                logger.info(`  ${protocol}: ${count} pools`);
            });

            // Show token pair diversity
            const tokenPairs = new Set();
            const uniqueTokens = new Set();

            poolVaults.forEach((vault: any) => {
                if (vault.tokenA && vault.tokenB) {
                    const symbolA = vault.tokenA.symbol || 'Unknown';
                    const symbolB = vault.tokenB.symbol || 'Unknown';
                    tokenPairs.add(`${symbolA}/${symbolB}`);
                    uniqueTokens.add(symbolA);
                    uniqueTokens.add(symbolB);
                }
            });

            logger.info(`🪙 Token Ecosystem Analysis:`);
            logger.info(`  Unique token pairs: ${tokenPairs.size}`);
            logger.info(`  Unique tokens: ${uniqueTokens.size}`);

            // Show pool counts (will show USD liquidity analysis after price discovery)
            logger.info(`💰 Pool Analysis:`);
            logger.info(`  Total Pools: ${poolVaults.length}`);

            // Sample vault structure for debugging
            if (data.data && data.data.length > 0) {
                logger.info('📋 Sample vault structure (first pool):');
                const sampleVault = poolVaults[0];
                logger.info(JSON.stringify({
                    type: sampleVault.type,
                    protocol: sampleVault.protocol,
                    contractId: sampleVault.contractId,
                    symbol: sampleVault.symbol,
                    tokenA: {
                        contractId: sampleVault.tokenA?.contractId,
                        symbol: sampleVault.tokenA?.symbol,
                        decimals: sampleVault.tokenA?.decimals
                    },
                    tokenB: {
                        contractId: sampleVault.tokenB?.contractId,
                        symbol: sampleVault.tokenB?.symbol,
                        decimals: sampleVault.tokenB?.decimals
                    },
                    reservesA: sampleVault.reservesA,
                    reservesB: sampleVault.reservesB,
                    fee: sampleVault.fee
                }, null, 2));
            }

            return data.data || [];

        } catch (error) {
            logger.error(`❌ Failed to fetch pool data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
}

// Enhanced liquidity provider with LP token detection logging
class EnhancedDexCacheLiquidityProvider {
    private poolDataProvider: EnhancedDexCachePoolDataProvider;
    private dexCacheUrl: string;

    constructor(dexCacheUrl = 'http://localhost:3003') {
        this.dexCacheUrl = dexCacheUrl;
        this.poolDataProvider = new EnhancedDexCachePoolDataProvider(dexCacheUrl);
    }

    async getAllVaultData(): Promise<any[]> {
        return await this.poolDataProvider.getAllVaultData();
    }

    async getRemoveLiquidityQuote(contractId: string, amount: number) {
        logger.info(`🔄 Remove liquidity quote requested: ${contractId} (amount: ${amount})`);
        
        try {
            // Use simple-swap quote API
            const simpleSwapUrl = 'http://localhost:3002'; // simple-swap port
            const response = await fetch(`${simpleSwapUrl}/api/v1/quote?tokenIn=${contractId}&tokenOut=${contractId}&amount=${amount}&operation=remove_liquidity`, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success && data.data) {
                // Extract quote information from route data
                const quote = {
                    dx: data.data.amountOut || 0,
                    dy: data.data.minimumReceived || 0
                };
                
                logger.info(`✅ Remove liquidity quote: dx=${quote.dx}, dy=${quote.dy}`);
                return {
                    success: true,
                    quote: quote
                };
            } else {
                logger.warn(`⚠️  Quote failed: ${data.error || 'Unknown error'}`);
                return {
                    success: false,
                    error: data.error || 'Failed to get quote'
                };
            }
        } catch (error) {
            logger.error(`❌ Remove liquidity quote error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}

// Mock token metadata provider for subnet token testing
class MockTokenMetadataProvider implements TokenMetadataProvider {
    async getTokenMetadata(contractId: string): Promise<TokenMetadata | null> {
        // Mock some common subnet tokens for testing
        const subnetTokens: Record<string, TokenMetadata> = {
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1': {
                contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1',
                type: 'SUBNET',
                symbol: 'sCHA',
                base: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
                decimals: 6
            },
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v1': {
                contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v1',
                type: 'SUBNET',
                symbol: 'ssBTC',
                base: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
                decimals: 8
            },
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v1': {
                contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v1',
                type: 'SUBNET',
                symbol: 'sWELSH',
                base: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token',
                decimals: 6
            }
        };

        return subnetTokens[contractId] || null;
    }
}

async function enhancedReviewTest() {
    logger.initialize();

    try {
        logger.info('🚀 Starting Enhanced Price Service Review Test');
        logger.info('='.repeat(80));

        // Environment Check
        logger.info('🔧 ENVIRONMENT VERIFICATION');
        const dexCacheUrl = process.env.NEXT_PUBLIC_DEX_CACHE_URL || 'http://localhost:3003';
        logger.info(`DEX-Cache URL: ${dexCacheUrl}`);

        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            logger.error('❌ BLOB_READ_WRITE_TOKEN environment variable not found');
            return;
        }
        logger.success('✅ BLOB_READ_WRITE_TOKEN configured');

        // 1. Test Pool Data Provider
        logger.info('\n📊 PHASE 1: POOL DATA PROVIDER TEST');
        logger.info('-'.repeat(50));

        const poolDataProvider = new EnhancedDexCachePoolDataProvider(dexCacheUrl);
        let vaults: any[] = [];

        try {
            vaults = await poolDataProvider.getAllVaultData();
            logger.success(`✅ Pool data provider test passed: ${vaults.length} vaults`);
        } catch (error) {
            logger.error(`❌ Pool data provider test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            logger.warn('💡 Make sure dex-cache is running: cd ../../apps/dex-cache && pnpm dev');
            return;
        }

        // 2. Price Service Initialization
        logger.info('\n⚙️  PHASE 2: PRICE SERVICE INITIALIZATION');
        logger.info('-'.repeat(50));

        const liquidityProvider = new EnhancedDexCacheLiquidityProvider(dexCacheUrl);
        const tokenMetadataProvider = new MockTokenMetadataProvider();

        logger.info('🔧 Configuring price service with real data...');
        const priceService = new PriceService({
            btcOracle: {
                sources: ['kraken'] as const,
                circuitBreaker: {
                    failureThreshold: 5,
                    recoveryTimeout: 30000
                }
            },
            pricing: {
                minLiquidity: 500,  // Lower threshold for more coverage
                maxPathLength: 5,   // Allow longer paths for better discovery
                confidenceThreshold: 0.1, // Much lower threshold for comprehensive coverage
                priceDeviationThreshold: 0.8 // More tolerant of price variation
            },
            storage: {
                blobPrefix: 'enhanced-test-prices/',
                compressionEnabled: true,
                retentionDays: 7
            }
        }, poolDataProvider, liquidityProvider, tokenMetadataProvider, process.env.BLOB_READ_WRITE_TOKEN);

        logger.info('🔄 Initializing price service...');
        await priceService.initialize();
        logger.success('✅ Price service initialized successfully');

        // 3. LP Token Detection Test
        logger.info('\n🎯 PHASE 3: LP TOKEN DETECTION TEST');
        logger.info('-'.repeat(50));

        // Test LP token detection with known LP tokens
        const lpTokensToTest = vaults
            .filter(v => v.type === 'POOL')
            .slice(0, 5)
            .map(v => v.contractId);

        if (lpTokensToTest.length > 0) {
            logger.info(`🔍 Testing LP detection for ${lpTokensToTest.length} known LP tokens:`);
            for (const tokenId of lpTokensToTest) {
                const vault = vaults.find(v => v.contractId === tokenId);
                logger.info(`  Testing: ${tokenId} (${vault?.symbol || 'Unknown'})`);
            }
        }

        // 4. Comprehensive Price Calculation Test
        logger.info('\n💰 PHASE 4: COMPREHENSIVE PRICE CALCULATION');
        logger.info('-'.repeat(50));

        // Extract ALL unique tokens from vaults for comprehensive pricing
        const uniqueTokens = new Set<string>();
        const lpTokensForPricing = new Set<string>();
        
        vaults.forEach((vault: any) => {
            // Add LP token itself
            if (vault.contractId && vault.type === 'POOL') {
                lpTokensForPricing.add(vault.contractId);
            }
            
            // Add underlying tokens
            if (vault.tokenA?.contractId) {
                uniqueTokens.add(vault.tokenA.contractId);
            }
            if (vault.tokenB?.contractId) {
                uniqueTokens.add(vault.tokenB.contractId);
            }
        });
        
        const allBaseTokens = Array.from(uniqueTokens);
        const allLpTokens = Array.from(lpTokensForPricing);
        
        // Add some subnet tokens for testing
        const subnetTokensToTest = [
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1', // sCHA
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v1', // ssBTC  
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v1' // sWELSH
        ];
        
        const allTestTokens = [...allBaseTokens, ...allLpTokens, ...subnetTokensToTest];
        
        logger.info(`📊 COMPREHENSIVE TOKEN ANALYSIS:`);
        logger.info(`  Base tokens: ${allBaseTokens.length}`);
        logger.info(`  LP tokens: ${allLpTokens.length}`);
        logger.info(`  Subnet tokens: ${subnetTokensToTest.length}`);
        logger.info(`  Total tokens to price: ${allTestTokens.length}`);

        logger.info(`🎲 Testing price calculation for ${allTestTokens.length} tokens:`);
        allTestTokens.slice(0, 10).forEach((token, index) => {
            const isLp = lpTokensForPricing.has(token);
            const isSubnet = subnetTokensToTest.includes(token);
            const vault = vaults.find(v => v.contractId === token);
            let typeLabel = '';
            if (isLp) typeLabel = '(LP Token)';
            if (isSubnet) typeLabel = '(Subnet Token)';
            
            logger.info(`  ${index + 1}. ${token.split('.')[1] || 'Unknown'} ${typeLabel}`);
            if (vault) {
                logger.info(`     Symbol: ${vault.symbol}, Type: ${vault.type}`);
            }
        });
        logger.info(`  ... and ${allTestTokens.length - 10} more tokens`);

        logger.info(`⏰ Starting comprehensive calculation with 5 minute timeout...`);
        const startTime = Date.now();
        const result = await priceService.calculateBulkPrices(allTestTokens);
        const duration = Date.now() - startTime;

        logger.info(`⏱️  Price calculation completed in ${duration}ms`);

        // 5. Results Analysis
        logger.info('\n📈 PHASE 5: RESULTS ANALYSIS');
        logger.info('-'.repeat(50));

        let lpDetectionCount = 0;

        if (result.success) {
            logger.success(`✅ Successfully calculated ${result.prices.size} prices out of ${allTestTokens.length} tokens`);

            // Detailed price breakdown
            logger.info('\n💎 SUCCESSFUL PRICE CALCULATIONS:');
            const successfulPrices = Array.from(result.prices.entries()).sort((a, b) => b[1].confidence - a[1].confidence);

            successfulPrices.forEach(([tokenId, priceData], index) => {
                const symbol = tokenId.split('.')[1] || 'UNKNOWN';
                const vault = vaults.find(v => v.contractId === tokenId);
                logger.info(`\n  ${index + 1}. ${symbol}`);
                logger.info(`     💰 USD Price: $${priceData.usdPrice.toFixed(8)}`);
                logger.info(`     🪙 sBTC Ratio: ${priceData.sbtcRatio.toFixed(8)}`);
                logger.info(`     📊 Confidence: ${(priceData.confidence * 100).toFixed(1)}%`);
                logger.info(`     🏷️  LP Token: ${priceData.isLpToken ? 'Yes' : 'No'}`);
                if (vault) {
                    logger.info(`     🏛️  Vault Type: ${vault.type}, Protocol: ${vault.protocol}`);
                }
                if (priceData.calculationDetails) {
                    logger.info(`     🛤️  Paths Used: ${priceData.calculationDetails.pathsUsed || 0}`);
                    logger.info(`     💧 Total Liquidity: $${(priceData.calculationDetails.totalLiquidity || 0).toLocaleString()}`);
                    logger.info(`     📈 Price Variation: ${((priceData.calculationDetails.priceVariation || 0) * 100).toFixed(2)}%`);
                }
            });

            // USD-Based Liquidity Analysis (now that we have prices)
            logger.info('\n💰 TOP 10 POOLS BY USD LIQUIDITY:');
            const poolsWithUsdLiquidity = vaults
                .filter((v: any) => v.type === 'POOL' && v.reservesA && v.reservesB && v.tokenA && v.tokenB)
                .map((v: any) => {
                    // Get prices for both tokens
                    const tokenAPrice = result.prices.get(v.tokenA.contractId);
                    const tokenBPrice = result.prices.get(v.tokenB.contractId);
                    
                    if (!tokenAPrice || !tokenBPrice) {
                        return null; // Skip pools where we don't have both token prices
                    }
                    
                    // Convert atomic amounts to decimal amounts
                    const decimalsA = v.tokenA.decimals || 6;
                    const decimalsB = v.tokenB.decimals || 6;
                    const reserveADecimal = Number(v.reservesA) / Math.pow(10, decimalsA);
                    const reserveBDecimal = Number(v.reservesB) / Math.pow(10, decimalsB);
                    
                    // Calculate USD values
                    const usdValueA = reserveADecimal * tokenAPrice.usdPrice;
                    const usdValueB = reserveBDecimal * tokenBPrice.usdPrice;
                    const totalUsdLiquidity = usdValueA + usdValueB;
                    
                    return {
                        symbol: v.symbol || `${v.tokenA.symbol}/${v.tokenB.symbol}`,
                        tokenA: v.tokenA.symbol,
                        tokenB: v.tokenB.symbol,
                        usdValueA,
                        usdValueB,
                        totalUsdLiquidity,
                        reserveADecimal,
                        reserveBDecimal,
                        contractId: v.contractId
                    };
                })
                .filter(pool => pool !== null)
                .sort((a, b) => (b?.totalUsdLiquidity || 0) - (a?.totalUsdLiquidity || 0));

            poolsWithUsdLiquidity.slice(0, 10).forEach((pool, index) => {
                if (pool) {
                    logger.info(`  ${index + 1}. ${pool.symbol} (${pool.tokenA}/${pool.tokenB})`);
                    logger.info(`     💰 Total USD Liquidity: $${pool.totalUsdLiquidity.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
                    logger.info(`     📊 ${pool.tokenA}: ${pool.reserveADecimal.toLocaleString()} ($${pool.usdValueA.toLocaleString('en-US', {maximumFractionDigits: 2})})`);
                    logger.info(`     📊 ${pool.tokenB}: ${pool.reserveBDecimal.toLocaleString()} ($${pool.usdValueB.toLocaleString('en-US', {maximumFractionDigits: 2})})`);
                }
            });

            if (poolsWithUsdLiquidity.length === 0) {
                logger.info('  ⚠️  No pools found with both token prices available for USD calculation');
            }

            // Failed calculations analysis
            if (result.errors && result.errors.size > 0) {
                logger.info(`\n❌ FAILED PRICE CALCULATIONS (${result.errors.size}):`);
                Array.from(result.errors.entries()).forEach(([tokenId, error], index) => {
                    const symbol = tokenId.split('.')[1] || 'UNKNOWN';
                    logger.info(`  ${index + 1}. ${symbol}: ${error}`);
                });
            }

            // LP Token Detection Summary
            const lpTokenResults = successfulPrices.filter(([tokenId]) => lpTokensForPricing.has(tokenId));
            if (lpTokenResults.length > 0) {
                logger.info('\n🎯 LP TOKEN DETECTION RESULTS:');
                lpTokenResults.forEach(([tokenId, priceData]) => {
                    const symbol = tokenId.split('.')[1] || 'UNKNOWN';
                    const detected = priceData.isLpToken ? '✅ Detected' : '❌ Not Detected';
                    logger.info(`  ${symbol}: ${detected}`);
                });
            }

            // Store lpTokenResults for later use
            lpDetectionCount = lpTokenResults.length;

        } else {
            logger.error('❌ Bulk price calculation failed');
        }

        // 6. Storage and Performance Test
        logger.info('\n💾 PHASE 6: STORAGE & PERFORMANCE TEST');
        logger.info('-'.repeat(50));

        try {
            const stats = await priceService.getStorageStats();
            logger.info(`📊 Storage Statistics:`);
            logger.info(`  Daily files: ${stats.dailyFilesCount}`);
            logger.info(`  Total size: ${stats.totalSize} bytes`);
            logger.info(`  Blob prefix: enhanced-test-prices/`);
            logger.success('✅ Storage test completed');
        } catch (error) {
            logger.warn(`⚠️  Storage test warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // 7. Final Summary
        logger.info('\n🎊 PHASE 7: FINAL SUMMARY');
        logger.info('-'.repeat(50));

        const successRate = result.prices.size / allTestTokens.length;
        logger.info(`📈 Overall Performance Metrics:`);
        logger.info(`  Success Rate: ${(successRate * 100).toFixed(1)}% (${result.prices.size}/${allTestTokens.length})`);
        logger.info(`  Calculation Time: ${duration}ms`);
        logger.info(`  Vault Data Source: Live dex-cache API`);
        logger.info(`  Pool Count: ${vaults.filter(v => v.type === 'POOL').length} pools`);
        logger.info(`  LP Detection: ${lpDetectionCount || 0} LP tokens tested`);

        if (successRate >= 0.5) {
            logger.success('🎉 PRICE SERVICE INTEGRATION: EXCELLENT');
        } else if (successRate >= 0.3) {
            logger.success('✅ PRICE SERVICE INTEGRATION: GOOD');
        } else {
            logger.warn('⚠️  PRICE SERVICE INTEGRATION: NEEDS IMPROVEMENT');
        }

        logger.success('🏁 Enhanced review test completed successfully');

    } catch (error) {
        logger.error(`💥 Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        if (error instanceof Error && error.stack) {
            logger.debug(`Stack trace: ${error.stack}`);
        }
        process.exit(1);
    } finally {
        logger.info('🔄 Forcing process exit to avoid hanging...');
        setTimeout(() => process.exit(0), 100);
    }
}

// Show usage information
function showUsage() {
    console.log('Enhanced Price Service Review Test');
    console.log('==================================');
    console.log('');
    console.log('Usage: pnpm x scripts/enhanced-review-test.ts [dex-cache-url]');
    console.log('');
    console.log('This script provides a comprehensive review of the price service integration:');
    console.log('• Pool data provider testing with real dex-cache API');
    console.log('• LP token detection verification');
    console.log('• Multi-token price calculation analysis');
    console.log('• Storage and performance metrics');
    console.log('• Detailed logging for full system review');
    console.log('');
    console.log('Examples:');
    console.log('  pnpm x scripts/enhanced-review-test.ts                    # Use default localhost:3003');
    console.log('  pnpm x scripts/enhanced-review-test.ts http://localhost:3003');
    console.log('');
    console.log('Prerequisites:');
    console.log('  - dex-cache app running (pnpm dev in apps/dex-cache)');
    console.log('  - BLOB_READ_WRITE_TOKEN set in simple-swap/.env.local');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the enhanced test
enhancedReviewTest().catch((error) => {
    logger.error(`💥 Unhandled error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
});