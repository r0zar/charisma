import { NextResponse } from "next/server";
import { subBalance, getBalance, totalSupply, totalStableSupply, getTokenFees } from "@/lib/stablecoin/state";
import { getTokenPrice, getTokenDecimals } from "../../utils";

export async function POST(req: Request) {
    try {
        const { tokenContractId, amountTokens, sender } = await req.json();
        if (!tokenContractId || typeof amountTokens !== 'number' || amountTokens <= 0 || !sender) {
            return NextResponse.json({ error: 'invalid params' }, { status: 400 });
        }
        const [price, decimals, currentSupplyRaw, feePool] = await Promise.all([
            getTokenPrice(tokenContractId),
            getTokenDecimals(tokenContractId),
            totalSupply(),
            getTokenFees()
        ]);
        const factor = 10 ** decimals;
        const newCollateralRaw = currentSupplyRaw + feePool - amountTokens;
        const stableCents = await totalStableSupply();
        const collateralUsdCents = Math.floor(newCollateralRaw * price * 100 / factor);
        const minCollateralCents = Math.ceil(stableCents * 1.5);
        if (collateralUsdCents < minCollateralCents) {
            return NextResponse.json({ error: 'Collateral ratio below 150%' }, { status: 400 });
        }
        const ok = await subBalance(sender, amountTokens);
        if (!ok) return NextResponse.json({ error: 'Insufficient collateral' }, { status: 400 });
        const bal = await getBalance(sender);
        return NextResponse.json({ withdrawn: amountTokens, newBalance: bal, collateralRatio: collateralUsdCents / (stableCents || 1) });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'server' }, { status: 500 });
    }
} 