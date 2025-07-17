/**
 * Price Update Scheduler - Background job system
 * 
 * Orchestrates periodic price calculations using the three-engine system
 * and stores results in price series storage for efficient consumption.
 */

import type { PriceServiceOrchestrator } from '../orchestrator/price-service-orchestrator';
import type { PriceSeriesStorage } from './price-series-storage';

export interface SchedulerConfig {
    updateInterval: number; // milliseconds
    batchSize: number;
    maxRetries: number;
    healthCheckInterval: number;
}

export interface SchedulerStats {
    lastUpdateTime: number;
    lastUpdateDuration: number;
    totalUpdates: number;
    failedUpdates: number;
    tokensProcessed: number;
    averageUpdateTime: number;
    nextUpdateTime: number;
}

/**
 * Price Update Scheduler
 * 
 * Runs the expensive three-engine calculations on a schedule and stores
 * results in Vercel Blob for efficient public consumption.
 */
export class PriceUpdateScheduler {
    private orchestrator: PriceServiceOrchestrator;
    private storage: PriceSeriesStorage;
    private config: SchedulerConfig;
    private stats: SchedulerStats;
    private updateTimer: NodeJS.Timeout | null = null;
    private isRunning = false;

    constructor(
        orchestrator: PriceServiceOrchestrator,
        storage: PriceSeriesStorage,
        config?: Partial<SchedulerConfig>
    ) {
        this.orchestrator = orchestrator;
        this.storage = storage;
        this.config = {
            updateInterval: 5 * 60 * 1000, // 5 minutes
            batchSize: 20,
            maxRetries: 3,
            healthCheckInterval: 60 * 1000, // 1 minute
            ...config
        };
        
        this.stats = {
            lastUpdateTime: 0,
            lastUpdateDuration: 0,
            totalUpdates: 0,
            failedUpdates: 0,
            tokensProcessed: 0,
            averageUpdateTime: 0,
            nextUpdateTime: 0
        };
    }

    /**
     * Start the scheduler
     */
    start(): void {
        if (this.isRunning) {
            console.log('[PriceScheduler] Already running');
            return;
        }

        this.isRunning = true;
        console.log(`[PriceScheduler] Starting with ${this.config.updateInterval / 1000}s intervals`);
        
        // Run immediately, then schedule
        this.runUpdate().then(() => {
            this.scheduleNextUpdate();
        });
    }

    /**
     * Stop the scheduler
     */
    stop(): void {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        console.log('[PriceScheduler] Stopped');
    }

    /**
     * Schedule the next update
     */
    private scheduleNextUpdate(): void {
        if (!this.isRunning) return;

        this.stats.nextUpdateTime = Date.now() + this.config.updateInterval;
        
        this.updateTimer = setTimeout(async () => {
            await this.runUpdate();
            this.scheduleNextUpdate();
        }, this.config.updateInterval);
    }

    /**
     * Run a price update cycle
     */
    private async runUpdate(): Promise<void> {
        const startTime = Date.now();
        console.log('[PriceScheduler] Starting price update cycle...');

        try {
            // Get all known tokens (this would come from your token registry)
            const allTokens = await this.getAllKnownTokens();
            console.log(`[PriceScheduler] Found ${allTokens.length} tokens to price`);

            // Calculate prices using the three-engine orchestrator
            const result = await this.orchestrator.calculateMultipleTokenPrices(allTokens, {
                includeArbitrageAnalysis: true,
                batchSize: this.config.batchSize,
                useCache: false // Always get fresh prices for scheduled updates
            });

            // Count arbitrage opportunities
            let arbitrageCount = 0;
            result.prices.forEach(price => {
                if (price.arbitrageOpportunity?.profitable) {
                    arbitrageCount++;
                }
            });

            // Store in price series
            await this.storage.storePriceSnapshot({
                timestamp: Date.now(),
                prices: result.prices,
                metadata: {
                    engineStats: result.debugInfo?.engineStats,
                    calculationTime: result.debugInfo?.calculationTimeMs,
                    arbitrageOpportunities: arbitrageCount,
                    totalTokens: allTokens.length
                }
            });

            // Update stats
            const duration = Date.now() - startTime;
            this.updateStats(true, duration, result.prices.size);

            console.log(`[PriceScheduler] ✅ Update complete: ${result.prices.size}/${allTokens.length} tokens priced in ${duration}ms`);
            console.log(`[PriceScheduler] Engine usage:`, result.debugInfo?.engineStats);
            console.log(`[PriceScheduler] Arbitrage opportunities: ${arbitrageCount}`);

        } catch (error) {
            console.error('[PriceScheduler] ❌ Update failed:', error);
            this.updateStats(false, Date.now() - startTime, 0);
            
            // Could implement exponential backoff here
            // For now, just continue with normal schedule
        }
    }

    /**
     * Update internal statistics
     */
    private updateStats(success: boolean, duration: number, tokensProcessed: number): void {
        this.stats.lastUpdateTime = Date.now();
        this.stats.lastUpdateDuration = duration;
        this.stats.totalUpdates++;
        this.stats.tokensProcessed += tokensProcessed;

        if (!success) {
            this.stats.failedUpdates++;
        }

        // Calculate rolling average update time
        const successfulUpdates = this.stats.totalUpdates - this.stats.failedUpdates;
        if (successfulUpdates > 0) {
            this.stats.averageUpdateTime = (
                (this.stats.averageUpdateTime * (successfulUpdates - 1)) + duration
            ) / successfulUpdates;
        }
    }

    /**
     * Get all known tokens that should be priced
     * This would integrate with your token registry/discovery system
     */
    private async getAllKnownTokens(): Promise<string[]> {
        // TODO: Implement token discovery
        // This could:
        // 1. Query your vault/pool data for all traded tokens
        // 2. Include a curated list of important tokens
        // 3. Read from a token registry API
        // 4. Combine multiple sources

        // For now, return a mock list
        return [
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
            'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
            // ... more tokens would come from discovery
        ];
    }

    /**
     * Get scheduler statistics
     */
    getStats(): SchedulerStats {
        return { ...this.stats };
    }

    /**
     * Get scheduler health status
     */
    getHealth(): {
        status: 'healthy' | 'degraded' | 'failed';
        uptime: number;
        lastSuccessAge: number;
        successRate: number;
        nextUpdateIn: number;
    } {
        const now = Date.now();
        const uptime = now - (this.stats.lastUpdateTime || now);
        const lastSuccessAge = now - this.stats.lastUpdateTime;
        const successRate = this.stats.totalUpdates > 0 
            ? (this.stats.totalUpdates - this.stats.failedUpdates) / this.stats.totalUpdates 
            : 1;
        const nextUpdateIn = Math.max(0, this.stats.nextUpdateTime - now);

        let status: 'healthy' | 'degraded' | 'failed' = 'healthy';
        
        if (successRate < 0.8 || lastSuccessAge > this.config.updateInterval * 2) {
            status = 'degraded';
        }
        
        if (successRate < 0.5 || lastSuccessAge > this.config.updateInterval * 5) {
            status = 'failed';
        }

        return {
            status,
            uptime,
            lastSuccessAge,
            successRate,
            nextUpdateIn
        };
    }

    /**
     * Force an immediate update (useful for testing/debugging)
     */
    async forceUpdate(): Promise<void> {
        console.log('[PriceScheduler] Force update requested');
        await this.runUpdate();
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<SchedulerConfig>): void {
        const oldInterval = this.config.updateInterval;
        this.config = { ...this.config, ...newConfig };
        
        // If interval changed and we're running, restart the timer
        if (this.isRunning && oldInterval !== this.config.updateInterval) {
            if (this.updateTimer) {
                clearTimeout(this.updateTimer);
            }
            this.scheduleNextUpdate();
            console.log(`[PriceScheduler] Update interval changed to ${this.config.updateInterval / 1000}s`);
        }
    }
}