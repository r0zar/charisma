import { NextRequest, NextResponse } from 'next/server';
import { calculateEarningsUSD, getCHAPrice, getTokenPrice } from '@/lib/token-prices';

/**
 * Test endpoint for earnings calculation
 */
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const chaAmount = Number(url.searchParams.get('cha') || '100');
    const tokensReceived = Number(url.searchParams.get('tokens') || '150');
    const tokenId = url.searchParams.get('tokenId') || 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-wstx';

    try {
        // Get individual prices
        const chaPrice = await getCHAPrice();
        const tokenPrice = await getTokenPrice(tokenId);

        // Calculate earnings
        const earnings = await calculateEarningsUSD(chaAmount, tokensReceived, tokenId);

        return NextResponse.json({
            success: true,
            test: {
                originalCHA: chaAmount,
                tokensReceived: tokensReceived,
                tokenId: tokenId
            },
            prices: {
                chaUSD: chaPrice,
                tokenUSD: tokenPrice
            },
            calculation: earnings,
            summary: {
                profitUSD: earnings.earningsUSD,
                profitCHA: earnings.earningsCHA,
                profitable: earnings.earningsUSD > 0
            }
        });
    } catch (error) {
        console.error('Test earnings calculation failed:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to calculate test earnings'
            },
            { status: 500 }
        );
    }
} 