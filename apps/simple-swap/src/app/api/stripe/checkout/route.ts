import { NextRequest } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-04-30.basil",
});

export async function POST(req: NextRequest) {
    const { userId, tokenAmount, tokenType, amount } = await req.json();

    if (!userId || !tokenAmount || !tokenType || !amount) {
        return new Response("Missing required fields", { status: 400 });
    }

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: "usd",
            automatic_payment_methods: { enabled: true },
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
