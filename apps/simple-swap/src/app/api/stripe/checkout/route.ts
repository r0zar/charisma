import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getTokenMetadataCached, listPrices } from "@repo/tokens";

function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2025-06-30.basil",
    });
}

export async function POST(req: NextRequest) {
    const { userId, tokenAmount, tokenType, amount } = await req.json();

    if (!userId || !tokenAmount || !tokenType || !amount) {
        return new Response("Missing required fields", { status: 400 });
    }

    // Fetch current price and compare to quoted price
    try {
        const token = await getTokenMetadataCached(tokenType);
        const prices = await listPrices();
        // Use base token price for subnet tokens if available
        let priceKey = tokenType;
        if (token?.type === 'SUBNET' && token.base && prices[token.base]) {
            priceKey = token.base;
        }
        const currentPrice = prices[priceKey];
        if (!currentPrice) {
            return new Response("Token price unavailable", { status: 400 });
        }
        // Calculate quoted price from amount/tokenAmount (amount is in cents, so divide by 100)
        const decimals = token?.decimals!;
        const quotedPrice = (amount / 100) * (10 ** decimals) / tokenAmount;
        const diff = Math.abs(currentPrice - quotedPrice) / quotedPrice;
        console.log({
            amount,
            tokenAmount,
            decimals,
            quotedPrice,
            currentPrice,
            diff,
            priceKey,
            tokenType,
            tokenBase: token?.base,
            tokenSymbol: token?.symbol
        });
        if (diff > 0.1) {
            return new Response("Token price changed by more than 10%. Please refresh and try again.", { status: 409 });
        }
    } catch (err) {
        return new Response("Failed to fetch token price", { status: 500 });
    }

    try {
        const stripe = getStripe();
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: "usd",
            // Allow card and cashapp payments, but disable Amazon Pay and Klarna
            payment_method_types: ["card", "cashapp"],
            metadata: {
                userId,
                tokenAmount,
                tokenType,
            },
        });

        return Response.json({ clientSecret: paymentIntent.client_secret });
    } catch (err: any) {
        console.error("[CreatePaymentIntent] Failed:", err);
        return new Response("Stripe error: " + err.message, { status: 500 });
    }
}
