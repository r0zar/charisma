import { listPositions, triggerPosition, closePosition, updateFundingFees } from './store';
import { PerpetualPosition } from './types';
import { getLatestPrice } from '@/lib/price/store';

// Get real-time price ratio for a trading pair (e.g., "STX/USDT")
async function getTradingPairPrice(tradingPair: string, baseToken: string, quoteToken: string): Promise<number | undefined> {
    try {
        const basePrice = await getLatestPrice(baseToken);
        const quotePrice = await getLatestPrice(quoteToken);

        if (basePrice === undefined || quotePrice === undefined) {
            console.log(`⚠️ Missing price data for ${tradingPair}: base=${basePrice}, quote=${quotePrice}`);
            return undefined;
        }

        if (quotePrice === 0) {
            console.log(`⚠️ Quote price is zero for ${tradingPair}`);
            return undefined;
        }

        // Return base token price in terms of quote token
        const price = basePrice / quotePrice;
        return price;
    } catch (err) {
        console.error(`Error fetching price for ${tradingPair}:`, err);
        return undefined;
    }
}

// Get current prices for all active trading pairs
async function getCurrentPrices(positions: PerpetualPosition[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};

    // Get unique trading pairs from positions
    const uniquePairs = new Set(positions.map(p => p.tradingPair));

    for (const pair of uniquePairs) {
        // Find a position with this pair to get the token contracts
        const samplePosition = positions.find(p => p.tradingPair === pair);
        if (!samplePosition) continue;

        const price = await getTradingPairPrice(
            pair,
            samplePosition.baseToken,
            samplePosition.baseAsset
        );

        if (price !== undefined) {
            prices[pair] = price;
        }
    }

    return prices;
}

export class PerpsMonitor {
    private isRunning = false;
    private intervalId: NodeJS.Timeout | null = null;

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        console.log('🚀 Starting perpetual positions monitor...');

        // Monitor every 60 seconds to align with oracle price updates
        this.intervalId = setInterval(async () => {
            try {
                await this.monitorPositions();
            } catch (err) {
                console.error('⚠️ Perps monitoring error:', err);
            }
        }, 60000);

        // Cleanup on process exit
        process.on('SIGINT', () => this.stop());
        process.on('SIGTERM', () => this.stop());
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('🛑 Stopped perpetual positions monitor');
    }

    private async monitorPositions() {
        const positions = await listPositions();
        const prices = await getCurrentPrices(positions);

        console.log(`🔍 Monitoring ${positions.length} positions...`);

        // Check pending positions for triggers
        const pendingPositions = positions.filter(p => p.status === 'pending');
        if (pendingPositions.length > 0) {
            await this.checkPendingPositions(pendingPositions, prices);
        }

        // Check open positions for close conditions
        const openPositions = positions.filter(p => p.status === 'open');
        if (openPositions.length > 0) {
            await this.checkOpenPositions(openPositions, prices);
            await this.updateFundingFeesForPositions(openPositions);
        }
    }

    private async checkPendingPositions(pending: PerpetualPosition[], prices: Record<string, number>) {
        for (const position of pending) {
            const currentPrice = prices[position.tradingPair];
            if (!currentPrice) {
                console.log(`⚠️ No price data for ${position.tradingPair}`);
                continue;
            }

            const triggerPrice = parseFloat(position.triggerPrice);
            let shouldTrigger = false;

            if (position.direction === 'long') {
                shouldTrigger = currentPrice >= triggerPrice;
            } else {
                shouldTrigger = currentPrice <= triggerPrice;
            }

            if (shouldTrigger) {
                await triggerPosition(position.uuid, currentPrice.toString());
                console.log(`🎯 Position ${position.uuid.slice(0, 8)} TRIGGERED! ${position.direction.toUpperCase()} at $${currentPrice} (trigger: $${triggerPrice})`);

                // TODO: Send WebSocket notification to frontend
                // await this.notifyFrontend({
                //     type: 'POSITION_TRIGGERED',
                //     position,
                //     triggerPrice: currentPrice
                // });
            }
        }
    }

    private async checkOpenPositions(openPositions: PerpetualPosition[], prices: Record<string, number>) {
        for (const position of openPositions) {
            const currentPrice = prices[position.tradingPair];
            if (!currentPrice) continue;

            const liquidationPrice = parseFloat(position.liquidationPrice);
            const stopLossPrice = position.stopLoss ? parseFloat(position.stopLoss) : null;
            const takeProfitPrice = position.takeProfit ? parseFloat(position.takeProfit) : null;

            let shouldClose = false;
            let closeReason: PerpetualPosition['closeReason'] = undefined;

            // Check liquidation (most critical)
            if (liquidationPrice > 0) {
                if ((position.direction === 'long' && currentPrice <= liquidationPrice) ||
                    (position.direction === 'short' && currentPrice >= liquidationPrice)) {
                    shouldClose = true;
                    closeReason = 'liquidated';
                }
            }

            // Check stop loss
            if (!shouldClose && stopLossPrice) {
                if ((position.direction === 'long' && currentPrice <= stopLossPrice) ||
                    (position.direction === 'short' && currentPrice >= stopLossPrice)) {
                    shouldClose = true;
                    closeReason = 'stop_loss';
                }
            }

            // Check take profit
            if (!shouldClose && takeProfitPrice) {
                if ((position.direction === 'long' && currentPrice >= takeProfitPrice) ||
                    (position.direction === 'short' && currentPrice <= takeProfitPrice)) {
                    shouldClose = true;
                    closeReason = 'take_profit';
                }
            }

            if (shouldClose && closeReason) {
                await closePosition(position.uuid, currentPrice.toString(), closeReason);
                console.log(`🚨 Position ${position.uuid.slice(0, 8)} CLOSED by ${closeReason.toUpperCase()} at $${currentPrice}`);

                // TODO: Send WebSocket notification to frontend
                // await this.notifyFrontend({
                //     type: 'POSITION_CLOSED',
                //     position,
                //     closePrice: currentPrice,
                //     closeReason
                // });
            }
        }
    }

    private async updateFundingFeesForPositions(openPositions: PerpetualPosition[]) {
        // Update funding fees every 5 minutes to avoid excessive calls
        const now = Date.now();
        const fiveMinutesAgo = now - 300_000;

        for (const position of openPositions) {
            const lastUpdate = new Date(position.lastFundingUpdate).getTime();
            if (lastUpdate < fiveMinutesAgo) {
                // Calculate additional funding fees since last update
                const additionalFees = this.calculateAdditionalFunding(position);
                if (additionalFees > 0) {
                    await updateFundingFees(position.uuid, additionalFees.toString());
                    console.log(`💸 Updated funding fees for position ${position.uuid.slice(0, 8)}: +$${additionalFees.toFixed(4)}`);
                }
            }
        }
    }

    private calculateAdditionalFunding(position: PerpetualPosition): number {
        const now = Date.now();
        const lastUpdate = new Date(position.lastFundingUpdate).getTime();
        const timeSinceUpdate = now - lastUpdate;
        const hoursSinceUpdate = timeSinceUpdate / (1000 * 60 * 60);

        // Funding parameters (more realistic for trading)
        const fundingPeriodHours = 8; // Every 8 hours (standard in perpetual futures)
        const fundingRatePerPeriod = 0.0001; // 0.01% per 8-hour period

        const newFundingPeriods = Math.floor(hoursSinceUpdate / fundingPeriodHours);
        if (newFundingPeriods === 0) return 0;

        const positionSize = parseFloat(position.positionSize);
        return newFundingPeriods * fundingRatePerPeriod * positionSize;
    }
}

// Export singleton instance
export const perpsMonitor = new PerpsMonitor(); 