import { priceSeriesService } from '../charts/price-series-service';
import { listPositions } from '../perps/store';
import { updateMarginUsage, getMarginAccount } from './store';

interface PositionPnL {
    uuid: string;
    owner: string;
    pnl: number;
    fundingFees: number;
}

// Calculate real-time P&L for a position
async function calculatePositionPnL(position: any): Promise<number> {
    if (!position.entryPrice || position.status !== 'open') {
        return 0;
    }

    try {
        // Get current prices
        const basePrice = await priceSeriesService.getCurrentPrice(position.baseToken);
        const quotePrice = await priceSeriesService.getCurrentPrice(position.baseAsset);

        if (basePrice === null || quotePrice === null || quotePrice === 0) {
            console.log(`⚠️ Missing price data for position ${position.uuid}`);
            return 0;
        }

        const currentPrice = basePrice / quotePrice;
        const entryPrice = parseFloat(position.entryPrice);
        const marginRequired = parseFloat(position.marginRequired);
        const leverage = position.leverage;

        // Calculate price change percentage
        const priceChangePercent = (currentPrice - entryPrice) / entryPrice;

        // Apply direction and leverage
        let pnlPercent = priceChangePercent * leverage;
        if (position.direction === 'short') {
            pnlPercent = -pnlPercent;
        }

        // Calculate absolute P&L in USD
        const pnlUsd = marginRequired * pnlPercent;

        // Calculate funding fees
        const fundingFees = calculateFundingFees(position);

        return pnlUsd - fundingFees;
    } catch (error) {
        console.error(`Error calculating P&L for position ${position.uuid}:`, error);
        return 0;
    }
}

// Calculate funding fees for a position
function calculateFundingFees(position: any): number {
    if (!position.entryTimestamp) {
        return 0;
    }

    const now = Date.now();
    const entryTime = new Date(position.entryTimestamp).getTime();
    const positionAgeMs = now - entryTime;
    const positionAgeHours = positionAgeMs / (1000 * 60 * 60);

    // Funding parameters (realistic trading environment)
    const fundingPeriodHours = 8; // Funding charged every 8 hours
    const fundingRatePerPeriod = 0.0001; // 0.01% per 8-hour period

    // Calculate how many complete funding periods have passed
    const completeFundingPeriods = Math.floor(positionAgeHours / fundingPeriodHours);

    // Calculate total funding fees
    const positionSize = parseFloat(position.positionSize);
    return completeFundingPeriods * fundingRatePerPeriod * positionSize;
}

// Sync P&L for all users' margin accounts
export async function syncAllMarginAccountPnL(): Promise<void> {
    try {
        console.log('🔄 Starting margin account P&L sync...');

        // Get all open positions
        const allPositions = await listPositions();
        const openPositions = allPositions.filter(p => p.status === 'open');

        if (openPositions.length === 0) {
            console.log('📊 No open positions to sync');
            return;
        }

        // Group positions by owner
        const positionsByOwner: Record<string, any[]> = {};
        openPositions.forEach(position => {
            if (!positionsByOwner[position.owner]) {
                positionsByOwner[position.owner] = [];
            }
            positionsByOwner[position.owner].push(position);
        });

        // Process each user's positions with migration support
        for (const [owner, positions] of Object.entries(positionsByOwner)) {
            // First, migrate any pre-existing positions that weren't tracked in margin system
            await migrateExistingPositions(owner, positions);

            let totalUnrealizedPnL = 0;

            // Calculate P&L for each position
            for (const position of positions) {
                const positionPnL = await calculatePositionPnL(position);
                totalUnrealizedPnL += positionPnL;
            }

            // Update margin account with new unrealized P&L
            await updateMarginUsage({
                owner,
                unrealizedPnL: totalUnrealizedPnL
            });

            console.log(`💹 Updated P&L for ${owner.substring(0, 8)}: ${totalUnrealizedPnL >= 0 ? '+' : ''}$${totalUnrealizedPnL.toFixed(2)} (${positions.length} positions)`);
        }

        console.log('✅ Margin account P&L sync completed');
    } catch (error) {
        console.error('❌ Error syncing margin account P&L:', error);
    }
}

// Migrate pre-existing positions to margin system
async function migrateExistingPositions(owner: string, openPositions: any[]): Promise<void> {
    if (openPositions.length === 0) return;

    try {
        // Get current margin account
        const marginAccount = await getMarginAccount(owner);

        // Calculate total margin that should be used based on open positions
        let expectedUsedMargin = 0;
        for (const position of openPositions) {
            if (position.marginRequired) {
                expectedUsedMargin += parseFloat(position.marginRequired);
            }
        }

        // Check if there's a significant mismatch (more than $0.01 difference)
        const currentUsedMargin = marginAccount.usedMargin;
        const marginDifference = Math.abs(expectedUsedMargin - currentUsedMargin);

        if (marginDifference > 0.01) {
            console.log(`🔧 Migrating positions for ${owner.substring(0, 8)}: Expected ${expectedUsedMargin.toFixed(2)}, Current ${currentUsedMargin.toFixed(2)}`);

            // Update to correct margin usage
            const marginAdjustment = expectedUsedMargin - currentUsedMargin;
            await updateMarginUsage({
                owner,
                usedMarginChange: marginAdjustment
            });

            console.log(`✅ Migrated ${openPositions.length} positions, adjusted margin by ${marginAdjustment >= 0 ? '+' : ''}${marginAdjustment.toFixed(2)}`);
        }
    } catch (error) {
        console.error(`❌ Error migrating positions for user ${owner}:`, error);
    }
}

// Sync P&L for a specific user (with migration support)
export async function syncUserMarginAccountPnL(owner: string): Promise<void> {
    try {
        console.log(`🔄 Syncing P&L for user: ${owner.substring(0, 8)}...`);

        // Get user's open positions
        const allPositions = await listPositions(owner);
        const openPositions = allPositions.filter(p => p.status === 'open');

        // First, migrate any pre-existing positions that weren't tracked in margin system
        await migrateExistingPositions(owner, openPositions);

        let totalUnrealizedPnL = 0;

        // Calculate P&L for each position
        for (const position of openPositions) {
            const positionPnL = await calculatePositionPnL(position);
            totalUnrealizedPnL += positionPnL;
        }

        // Update margin account with new unrealized P&L
        await updateMarginUsage({
            owner,
            unrealizedPnL: totalUnrealizedPnL
        });

        console.log(`💹 Updated P&L for ${owner.substring(0, 8)}: ${totalUnrealizedPnL >= 0 ? '+' : ''}$${totalUnrealizedPnL.toFixed(2)} (${openPositions.length} positions)`);
    } catch (error) {
        console.error(`❌ Error syncing P&L for user ${owner.substring(0, 8)}:`, error);
    }
}

// Export migration function for external use
export { migrateExistingPositions }; 