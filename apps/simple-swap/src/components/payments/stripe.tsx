// components/stripe/StripePaymentForm.tsx
"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/wallet-context";
import { CHARISMA_TOKEN_SUBNET } from "@/lib/constants";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const RETURN_URL = process.env.NODE_ENV === "development" ? "http://localhost:3002/fiat" : "https://swap.charisma.rocks/fiat";

function CheckoutForm() {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setLoading(true);
        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: RETURN_URL,
            },
        });

        if (error) console.error(error.message);
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement />
            <Button type="submit" disabled={!stripe || loading} className="w-full">
                {loading ? "Processing…" : "Submit Payment"}
            </Button>
        </form>
    );
}

export default function StripePaymentForm() {
    const [clientSecret, setClientSecret] = useState<string | null>(null);

    const { address } = useWallet();

    useEffect(() => {
        if (!address) return;
        fetch("/api/create-payment-intent", {
            method: "POST",
            body: JSON.stringify({
                userId: address,            // required
                tokenAmount: 1,              // required
                tokenType: CHARISMA_TOKEN_SUBNET,              // required
                amount: 100                   // required
            }),
            headers: { "Content-Type": "application/json" },
        })

            .then(res => res.json())
            .then(data => setClientSecret(data.clientSecret));
    }, [address]);

    if (!clientSecret) return <p>Loading payment form…</p>;

    return (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm />
        </Elements>
    );
}
