import { NextResponse } from 'next/server';
import { listPrices } from '@repo/tokens';

const CHA_TOKEN_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token";

export async function GET() {
    try {
        const prices = await listPrices();
        const chaPrice = prices[CHA_TOKEN_CONTRACT];

        return NextResponse.json({
            success: true,
            chaPrice,
            contractId: CHA_TOKEN_CONTRACT,
            allPrices: Object.keys(prices).length
        });
    } catch (error) {
        console.error('Failed to fetch CHA price:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 