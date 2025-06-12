import { NextResponse } from 'next/server';
import { getPosition } from '@/lib/perps/store';
import { getLatestPrice } from '@/lib/price/store';

// Helper function to calculate real-time P&L
function calculateRealTimePnL(position: any, currentPrice: number) {
    if (!position.entryPrice || position.status !== 'open') {
        console.log(`❌ P&L calculation failed for ${position.uuid}:`, {
            hasEntryPrice: !!position.entryPrice,
            status: position.status,
            entryPrice: position.entryPrice
        });
        return {
            pnl: 0,
            pnlPercentage: 0,
            fundingFees: 0
        };
    }

    const entryPrice = parseFloat(position.entryPrice);
    const positionSize = parseFloat(position.positionSize);
    const leverage = position.leverage;
    const marginRequired = parseFloat(position.marginRequired);

    // Calculate price change percentage
    const priceChangePercent = (currentPrice - entryPrice) / entryPrice;

    // Apply direction and leverage
    let pnlPercent = priceChangePercent * leverage;
    if (position.direction === 'short') {
        pnlPercent = -pnlPercent; // Invert for short positions
    }

    // Calculate absolute P&L in USD
    const pnlUsd = marginRequired * pnlPercent;

    // Calculate funding fees
    const fundingFees = calculateFundingFees(position);

    return {
        pnl: pnlUsd - fundingFees,
        pnlPercentage: pnlPercent * 100,
        fundingFees
    };
}

// Helper function to calculate funding fees
function calculateFundingFees(position: any) {
    if (!position.entryTimestamp) {
        console.log(`⚠️ No entryTimestamp for position ${position.uuid}`);
        return 0;
    }

    const now = Date.now();
    const entryTime = new Date(position.entryTimestamp).getTime();
    const positionAgeMs = now - entryTime;
    const positionAgeHours = positionAgeMs / (1000 * 60 * 60);

    // Funding parameters (realistic trading environment)
    const fundingPeriodHours = 8; // Funding charged every 8 hours (standard)
    const fundingRatePerPeriod = 0.0001; // 0.01% per 8-hour period

    // Calculate how many complete funding periods have passed
    const completeFundingPeriods = Math.floor(positionAgeHours / fundingPeriodHours);

    // Calculate total funding fees
    const positionSize = parseFloat(position.positionSize);
    const totalFundingFee = completeFundingPeriods * fundingRatePerPeriod * positionSize;

    console.log(`💸 Funding calculation for ${position.uuid}:`, {
        positionAgeHours: positionAgeHours.toFixed(2),
        completeFundingPeriods,
        positionSize,
        totalFundingFee: totalFundingFee.toFixed(6),
        entryTimestamp: position.entryTimestamp
    });

    return totalFundingFee;
}

// Get current price for a trading pair using real price feed
async function getCurrentPrice(baseToken: string, quoteToken: string): Promise<number | undefined> {
    try {
        const basePrice = await getLatestPrice(baseToken);
        const quotePrice = await getLatestPrice(quoteToken);

        if (basePrice === undefined || quotePrice === undefined) {
            console.log(`⚠️ Missing price data: base=${basePrice}, quote=${quotePrice}`);
            return undefined;
        }

        if (quotePrice === 0) {
            console.log(`⚠️ Quote price is zero`);
            return undefined;
        }

        // Return base token price in terms of quote token
        return basePrice / quotePrice;
    } catch (err) {
        console.error('Error fetching price:', err);
        return undefined;
    }
}

export async function GET(req: Request, { params }: { params: { uuid: string } }) {
    try {
        const { uuid } = await params;
        const position = await getPosition(uuid);
        if (!position) {
            return NextResponse.json({ error: 'Position not found' }, { status: 404 });
        }

        console.log(`🔍 P&L Debug for ${uuid}:`, {
            status: position.status,
            entryPrice: position.entryPrice,
            baseToken: position.baseToken,
            baseAsset: position.baseAsset,
            entryTimestamp: position.entryTimestamp,
            positionSize: position.positionSize,
            direction: position.direction,
            leverage: position.leverage
        });

        if (position.status === 'pending') {
            return NextResponse.json({
                pnl: 0,
                pnlPercentage: 0,
                isActive: false,
                status: 'pending',
                fundingFees: 0
            });
        }

        if (position.status === 'closed') {
            // For closed positions, calculate final P&L
            const entryPrice = parseFloat(position.entryPrice || '0');
            const closePrice = parseFloat(position.closePrice || '0');
            const marginRequired = parseFloat(position.marginRequired);
            const leverage = position.leverage;

            if (entryPrice > 0 && closePrice > 0) {
                const priceChangePercent = (closePrice - entryPrice) / entryPrice;
                let pnlPercent = priceChangePercent * leverage;
                if (position.direction === 'short') {
                    pnlPercent = -pnlPercent;
                }
                const finalPnL = marginRequired * pnlPercent;
                const fundingFees = parseFloat(position.totalFundingFees || '0');

                return NextResponse.json({
                    pnl: finalPnL - fundingFees,
                    pnlPercentage: pnlPercent * 100,
                    isActive: false,
                    status: 'closed',
                    closeReason: position.closeReason,
                    fundingFees
                });
            }
        }

        // Calculate real-time P&L for open positions
        const currentPrice = await getCurrentPrice(position.baseToken, position.baseAsset);

        console.log(`💰 Price data for ${uuid}:`, {
            currentPrice,
            baseToken: position.baseToken,
            baseAsset: position.baseAsset
        });

        if (currentPrice === undefined) {
            console.log(`❌ No price data available for position ${uuid}`);
            return NextResponse.json({
                pnl: 0,
                pnlPercentage: 0,
                isActive: false,
                status: 'open',
                fundingFees: parseFloat(position.totalFundingFees || '0'),
                error: 'Price data unavailable'
            });
        }

        const pnlData = calculateRealTimePnL(position, currentPrice);

        console.log(`📊 P&L calculation result for ${uuid}:`, {
            ...pnlData,
            currentPrice,
            entryPrice: position.entryPrice
        });

        return NextResponse.json({
            ...pnlData,
            isActive: true,
            status: 'open',
            currentPrice
        });
    } catch (err) {
        console.error('PnL calculation error', err);
        return NextResponse.json({ error: 'Failed to calculate P&L' }, { status: 500 });
    }
} 