import { NextResponse } from "next/server"
import { getBalance, total_supply, getStable, totalStableSupply, getTokenFees, getUsdFees } from "@/lib/stablecoin/state"

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const address = searchParams.get('address') || ''
    if (!address) {
        return NextResponse.json({ error: 'Missing address' }, { status: 400 })
    }
    const [bal, stable, supply, stableSupply, feeTokenPool, feeUsdPool] = await Promise.all([
        getBalance(address),
        getStable(address),
        totalSupply(),
        totalStableSupply(),
        getTokenFees(),
        getUsdFees()
    ])
    return NextResponse.json({ balance: bal, total_supply: supply, stableBalance: stable, stableSupply, tokenFeePool: feeTokenPool, usdFeePool: feeUsdPool })
} 