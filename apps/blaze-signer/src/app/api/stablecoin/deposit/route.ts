import { NextResponse } from "next/server"
import { getTokenPrice, usdToTokens, getTokenDecimals } from "../utils"
import { addBalance, addStable, addTokenFees, getBalance, getStable, getTokenFees } from "@/lib/stablecoin/state"

export async function POST(req: Request) {
    try {
        const { usdAmount, boundTokens, sender, tokenContractId } = await req.json()

        if (typeof usdAmount !== "number" || usdAmount <= 0) {
            return NextResponse.json({ error: "Invalid usdAmount" }, { status: 400 })
        }
        if (typeof boundTokens !== "number" || boundTokens <= 0) {
            return NextResponse.json({ error: "Invalid boundTokens" }, { status: 400 })
        }
        if (typeof sender !== "string" || !sender) {
            return NextResponse.json({ error: "Missing sender" }, { status: 400 })
        }

        const [price, decimals] = await Promise.all([getTokenPrice(tokenContractId), getTokenDecimals(tokenContractId)])
        const needed = usdToTokens(usdAmount, price, decimals)
        const fee = Math.ceil(needed * 0.01)
        const totalRequired = needed + fee

        if (totalRequired > boundTokens) {
            return NextResponse.json({ error: "Total (incl fee) exceeds bound" }, { status: 400 })
        }

        await Promise.all([
            addBalance(sender, needed),
            addStable(sender, Math.round(usdAmount * 100)),
            addTokenFees(fee)
        ])
        const [balance, stableBal, feePool] = await Promise.all([getBalance(sender), getStable(sender), getTokenFees()])

        return NextResponse.json({ tokensDeposited: needed, feeTokens: fee, totalTokens: totalRequired, newBalance: balance, stableBalance: stableBal, chaFeePool: feePool })
    } catch (err) {
        console.error("deposit error", err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
} 