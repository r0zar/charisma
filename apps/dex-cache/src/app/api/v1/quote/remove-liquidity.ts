import { NextRequest, NextResponse } from 'next/server';
import { getRemoveLiquidityQuote } from '@/app/actions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { vaultContractId, targetLpAmountToBurn } = body;
        if (typeof vaultContractId !== 'string' || typeof targetLpAmountToBurn !== 'number') {
            return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
        }
        const result = await getRemoveLiquidityQuote(vaultContractId, targetLpAmountToBurn);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
} 