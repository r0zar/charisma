import { NextResponse } from "next/server"
import { getTokenPrice, usdToTokens, getTokenDecimals } from "../utils"
import { subBalance, getBalance, subStable, getStable, addUsdFees, getUsdFees, total_supply, totalStableSupply } from "@/lib/stablecoin/state"

export async function POST(req: Request) {
    try {
        const { usdAmount, sender, tokenContractId } = await req.json()
        if (typeof usdAmount !== "number" || usdAmount <= 0) {
            return NextResponse.json({ error: "Invalid usdAmount" }, { status: 400 })
        }
        if (typeof sender !== "string" || !sender) {
            return NextResponse.json({ error: "Missing sender" }, { status: 400 })
        }

        const [price, decimals] = await Promise.all([getTokenPrice(tokenContractId), getTokenDecimals(tokenContractId)])
        const tokens = usdToTokens(usdAmount, price, decimals) // CHA tokens user will receive

        const usdCents = Math.round(usdAmount * 100)
        const feeCents = Math.ceil(usdCents * 0.01) // 1% fee in cents
        const totalStableBurn = usdCents + feeCents

        // 1. burn user stable (including fee)
        const okStable = await subStable(sender, totalStableBurn)
        if (!okStable) {
            return NextResponse.json({ error: "Insufficient stable balance" }, { status: 400 })
        }

        // 2. send CHA tokens to user (no CHA fee)
        const okCha = await subBalance("_VAULT", tokens)
        if (!okCha) {
            // revert stable burn? skip for now
            return NextResponse.json({ error: "Insufficient CHA pool" }, { status: 400 })
        }

        // 3. accumulate USD fee pool
        await addUsdFees(feeCents)

        const [balance, stableBal, usdFeePool] = await Promise.all([getBalance(sender), getStable(sender), getUsdFees()])
        return NextResponse.json({ tokensWithdrawn: tokens, feeUsdCents: feeCents, newBalance: balance, stableBalance: stableBal, usdFeePool })
    } catch (err) {
        console.error("withdraw error", err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
} 