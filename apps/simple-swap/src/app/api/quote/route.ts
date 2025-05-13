import { NextResponse } from 'next/server';
import { getQuote } from '../../actions';

export async function GET() {
    const chaContractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
    try {
        const result = await getQuote('.stx', chaContractId, '1000000', {
            excludeVaultIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-cha-vault-wrapper-alex']
        });
        if (result.success && result.data) {
            const decimals = 6;
            const chaAmount = Number(result.data.amountOut) / 10 ** decimals;
            return NextResponse.json({ success: true, rate: chaAmount });
        }
        return NextResponse.json({ success: false });
    } catch (e) {
        return NextResponse.json({ success: false });
    }
} 