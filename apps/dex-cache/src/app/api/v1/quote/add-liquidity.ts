import { NextRequest, NextResponse } from 'next/server';
import { getAddLiquidityQuoteAndSupply } from '@/app/actions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { vaultContractId, targetLpAmount } = body;
        if (typeof vaultContractId !== 'string' || typeof targetLpAmount !== 'number') {
            return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
        }
        const result = await getAddLiquidityQuoteAndSupply(vaultContractId, targetLpAmount);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
} 