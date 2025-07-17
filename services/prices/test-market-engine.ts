#!/usr/bin/env node

/**
 * Test script for the new tryMarketEngine implementation
 */

import { PriceServiceOrchestrator } from '../src/orchestrator/price-service-orchestrator';
import { OracleEngine } from '../src/engines/oracle-engine';
import { CpmmEngine } from '../src/engines/cpmm-engine';
import { IntrinsicValueEngine } from '../src/engines/intrinsic-value-engine';
import { logger } from './logger';

async function testMarketEngine() {
    logger.info('Testing Market Engine Implementation');
    logger.info('=====================================');

    // Initialize orchestrator
    const orchestrator = new PriceServiceOrchestrator();
    
    // Set up engines
    const oracleEngine = new OracleEngine();
    const cpmmEngine = new CpmmEngine();
    const intrinsicEngine = new IntrinsicValueEngine();
    
    orchestrator.setOracleEngine(oracleEngine);
    orchestrator.setCpmmEngine(cpmmEngine);
    orchestrator.setIntrinsicEngine(intrinsicEngine);

    logger.success('Engines initialized');

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

    // Test 2: Try market engine with a different token (will likely fail without pool data)
    logger.info('Test 2: Market engine with different token');
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