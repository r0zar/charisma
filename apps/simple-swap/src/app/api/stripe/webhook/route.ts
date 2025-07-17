import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { kv } from '@vercel/kv';
import { buildAndSignBlazeIntent } from '@/lib/blaze-intent-server';
import { BLAZE_SIGNER_PRIVATE_KEY } from '@/lib/constants';

function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-06-30.basil',
    });
}

function getEndpointSecret() {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }
    return process.env.STRIPE_WEBHOOK_SECRET;
}

export const config = {
    api: {
        bodyParser: false,
    },
};

export async function POST(req: NextRequest) {
    let rawBody: ArrayBuffer;
    let event: Stripe.Event;

    try {
        const stripe = getStripe();
        const endpointSecret = getEndpointSecret();
        
        rawBody = await req.arrayBuffer();
        const sig = req.headers.get('stripe-signature');

        if (!sig || !endpointSecret) {
            return new Response('Missing signature or secret', { status: 400 });
        }

        event = stripe.webhooks.constructEvent(Buffer.from(rawBody), sig, endpointSecret);
    } catch (err) {
        console.error('[Webhook] Signature verification failed:', err);
        return new Response('Webhook Error: ' + (err as Error).message, { status: 400 });
    }

    if (event.type === 'payment_intent.succeeded') {
        const intent = event.data.object as Stripe.PaymentIntent;
        const { id: stripeIntentId, metadata, amount, currency } = intent;
        const { userId, tokenAmount, tokenType } = metadata ?? {};

        if (!userId || !tokenAmount || !tokenType) {
            console.warn('[Webhook] Missing metadata in payment intent:', stripeIntentId);
            return new Response('Missing metadata', { status: 400 });
        }

        const kvKey = `intent:${stripeIntentId}`;
        const alreadyExists = await kv.get(kvKey);
        if (alreadyExists) {
            console.log(`[Webhook] Duplicate: ${stripeIntentId}`);
            return new Response('Already processed', { status: 200 });
        }

        console.log(`[Webhook] Processing intent: ${stripeIntentId}`, {
            userId,
            tokenAmount,
            tokenType,
            amount,
            currency,
        });

        const blaze = await buildAndSignBlazeIntent({
            contract: tokenType,
            intent: 'TRANSFER_TOKENS',
            amount: Number(tokenAmount),
            target: userId,
            uuid: stripeIntentId,
            senderKey: BLAZE_SIGNER_PRIVATE_KEY!, // TODO: use reserves private key
            chainId: 1,
        });

        await kv.set(kvKey, {
            pid: stripeIntentId,
            userId,
            tokenAmount,
            tokenType,
            amount,
            currency,
            blaze,
            status: 'queued',
            createdAt: Date.now(),
        });

        console.info(`[Webhook] Stored Blaze intent: ${stripeIntentId} for ${userId}`);
    }

    return new Response('OK', { status: 200 });
}
