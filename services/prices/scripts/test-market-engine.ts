#!/usr/bin/env node

/**
 * Test script for the new tryMarketEngine implementation
 */

import { PriceServiceOrchestrator } from '../src/orchestrator/price-service-orchestrator';
import { OracleEngine } from '../src/engines/oracle-engine';
import { CpmmEngine, CpmmPoolDataProvider, PoolData } from '../src/engines/cpmm-engine';
import { VirtualEngine } from '../src/engines/virtual-engine';
import { logger } from './logger';

/**
 * Dex Cache Pool Data Provider - connects to dex-cache API
 */
class DexCachePoolDataProvider implements CpmmPoolDataProvider {
    private dexCacheUrl: string;

    constructor(dexCacheUrl = 'http://localhost:3003') {
        this.dexCacheUrl = dexCacheUrl;
    }

    async getAllVaultData(): Promise<PoolData[]> {
        try {
            logger.info(`Fetching pool data from ${this.dexCacheUrl}/api/v1/vaults`);
            const response = await fetch(`${this.dexCacheUrl}/api/v1/vaults`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const vaults = data.data || [];
            
            logger.info(`Received ${vaults.length} total vaults from dex-cache`);
            
            // Filter for CHARISMA protocol pools
            const pools = vaults.filter((vault: any) => 
                vault.type === 'POOL' && 
                vault.protocol === 'CHARISMA' &&
                vault.tokenA && 
                vault.tokenB &&
                vault.reservesA !== undefined &&
                vault.reservesB !== undefined
            );
            
            logger.info(`Filtered to ${pools.length} CHARISMA pools`);
            
            // Convert to PoolData format
            const poolData: PoolData[] = pools.map((vault: any) => ({
                contractId: vault.contractId,
                type: vault.type,
                protocol: vault.protocol,
                tokenA: {
                    contractId: vault.tokenA.contractId,
                    symbol: vault.tokenA.symbol,
                    name: vault.tokenA.name,
                    decimals: vault.tokenA.decimals || 6
                },
                tokenB: {
                    contractId: vault.tokenB.contractId,
                    symbol: vault.tokenB.symbol,
                    name: vault.tokenB.name,
                    decimals: vault.tokenB.decimals || 6
                },
                reservesA: typeof vault.reservesA === 'string' ? parseFloat(vault.reservesA) : vault.reservesA,
                reservesB: typeof vault.reservesB === 'string' ? parseFloat(vault.reservesB) : vault.reservesB
            }));
            
            logger.success(`Successfully converted ${poolData.length} pools to PoolData format`);
            return poolData;
            
        } catch (error) {
            logger.error(`Failed to fetch pool data: ${error}`);
            
            // Return mock data for testing if API fails
            logger.warn('Falling back to mock pool data');
            return this.getMockPoolData();
        }
    }

    private getMockPoolData(): PoolData[] {
        const sbtcContractId = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';
        const charismaContractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
        
        return [
            {
                contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-sbtc-pool-v1',
                type: 'POOL',
                protocol: 'CHARISMA',
                tokenA: {
                    contractId: sbtcContractId,
                    symbol: 'sBTC',
                    name: 'Stacks BTC',
                    decimals: 8
                },
                tokenB: {
                    contractId: charismaContractId,
                    symbol: 'CHA',
                    name: 'Charisma',
                    decimals: 6
                },
                reservesA: 1000000000, // 10 sBTC (8 decimals)
                reservesB: 100000000000000 // 100M CHA (6 decimals)
            }
        ];
    }
}

async function testMarketEngine() {
    logger.info('Testing Market Engine Implementation');
    logger.info('=====================================');

    // Initialize orchestrator
    const orchestrator = new PriceServiceOrchestrator();
    
    // Set up engines
    const oracleEngine = new OracleEngine();
    const cpmmEngine = new CpmmEngine();
    const virtualEngine = new VirtualEngine();
    
    // Configure pool data provider for CPMM engine
    // Try localhost first, then production URL
    const dexCacheUrls = [
        'http://localhost:3003',
        'https://charisma-dex-cache.vercel.app'
    ];
    
    const poolDataProvider = new DexCachePoolDataProvider(dexCacheUrls[0]);
    cpmmEngine.setPoolDataProvider(poolDataProvider);
    
    orchestrator.setOracleEngine(oracleEngine);
    orchestrator.setCpmmEngine(cpmmEngine);
    orchestrator.setVirtualEngine(virtualEngine);

    logger.success('Engines initialized');
    
    // Build CPMM graph with pool data
    logger.info('Building CPMM liquidity graph...');
    try {
        await cpmmEngine.buildGraph();
        const stats = cpmmEngine.getStats();
        logger.success(`CPMM graph built: ${stats.totalTokens} tokens, ${stats.totalPools} pools`);
        
        // Show available tokens in the graph
        const tokens = cpmmEngine.getAllTokens();
        logger.info('Available tokens in CPMM graph:');
        tokens.forEach(token => {
            logger.info(`  ${token.symbol} (${token.contractId.slice(-20)}...)`);
        });
        
    } catch (error) {
        logger.error(`Failed to build CPMM graph: ${error}`);
    }

    // Test 1: Get sBTC price directly (should use oracle)
    logger.info('Test 1: Direct sBTC price (should use oracle)');
    const sbtcContractId = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';
    
    try {
        const result = await orchestrator.calculateTokenPrice(sbtcContractId, {
            preferredSources: ['market'],
            includeArbitrageAnalysis: false
        });
        
        if (result.success && result.price) {
            logger.success(`sBTC price: $${result.price.usdPrice.toFixed(2)} (source: ${result.price.source})`);
        } else {
            logger.error(`Failed to get sBTC price: ${result.error}`);
        }
    } catch (error) {
        logger.error(`Error getting sBTC price: ${error}`);
    }

    // Test 2: Try market engine with Charisma token (should find path via sBTC)
    logger.info('Test 2: Market engine with Charisma token');
    const testTokenId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
    
    try {
        const result = await orchestrator.calculateTokenPrice(testTokenId, {
            preferredSources: ['market'],
            includeArbitrageAnalysis: false
        });
        
        if (result.success && result.price) {
            logger.success(`${testTokenId} price: $${result.price.usdPrice.toFixed(6)} (source: ${result.price.source})`);
            logger.info(`   Reliability: ${result.price.reliability.toFixed(3)}`);
            if (result.price.marketData) {
                logger.info(`   Path length: ${result.price.marketData.primaryPath.pathLength}`);
                logger.info(`   Total liquidity: ${result.price.marketData.totalLiquidity.toFixed(2)}`);
            }
        } else {
            logger.warn(`No market path found for ${testTokenId}: ${result.error}`);
        }
    } catch (error) {
        logger.error(`Error with market engine: ${error}`);
    }

    // Test 3: Engine health status
    logger.info('Test 3: Engine health status');
    const healthStats = orchestrator.getEngineHealth();
    healthStats.forEach(health => {
        logger.info(`  ${health.engine}: ${health.status} (errors: ${health.errorRate.toFixed(2)})`);
    });

    logger.success('Test completed!');
}

// Run the test
testMarketEngine().catch(error => {
    logger.error(`Test failed: ${error}`);
    process.exit(1);
});