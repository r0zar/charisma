// components/stripe/StripePaymentForm.tsx
"use client";

import { useEffect, useState } from "react";
import { loadStripe, Appearance } from "@stripe/stripe-js";
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/wallet-context";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const RETURN_URL = process.env.NODE_ENV === "development" ? "http://localhost:3002/fiat" : "https://swap.charisma.rocks/fiat";

// New inner component for the form content
function CheckoutForm() {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);
    const [canSubmitPayment, setCanSubmitPayment] = useState(false);

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

        if (error) {
            console.error(error.message);
            // Optionally, display the error to the user
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement
                onReady={() => setIsPaymentElementReady(true)}
                onChange={(event) => setCanSubmitPayment(event.complete)}
            />
            <Button type="submit" disabled={!stripe || loading || !isPaymentElementReady || !canSubmitPayment} className="w-full">
                {loading ? "Processing…" : "Submit Payment"}
            </Button>
        </form>
    );
}

// Parent component that provides the Elements context
export default function StripePaymentForm({ tokenAmount, tokenType, amount }: { tokenAmount: number, tokenType: string, amount: number }) {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const { address } = useWallet();

    useEffect(() => {
        if (!address || !tokenAmount || !tokenType || !amount) return;
        // Fetch client secret from your backend
        fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: address,
                tokenAmount: tokenAmount,
                tokenType: tokenType,
                amount: amount,
            }),
        })
            .then((res) => res.json())
            .then((data) => setClientSecret(data.clientSecret));
    }, [address, tokenAmount, tokenType, amount]); // Added dependencies that affect clientSecret

    if (!clientSecret) {
        return <p>Loading payment form…</p>;
    }

    // Stripe Appearance API for custom styling
    const appearance: Appearance = {
        theme: 'night',
        variables: {
            colorPrimary: 'hsl(25 100% 58%)', // Tailwind slate-50
            colorBackground: 'hsl(223 47% 15%)', // Tailwind slate-50
            colorText: 'hsl(0 0% 95%)', // Tailwind slate-900
            borderRadius: '12px', // rounded-xl
        },

    };

    return (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <CheckoutForm />
        </Elements>
    );
}
