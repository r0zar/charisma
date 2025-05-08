import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NewOrderRequest } from '@/lib/orders/types';
import { addOrder } from '@/lib/orders/store';
import { callReadOnlyFunction } from '@repo/polyglot';
import { bufferFromHex } from '@stacks/transactions/dist/cl';
import {
    principalCV,
    stringAsciiCV,
    uintCV,
    noneCV,
    optionalCVOf,
} from '@stacks/transactions';

const schema: z.ZodType<NewOrderRequest> = z.object({
    owner: z.string().min(3),
    inputToken: z.string().includes('.'),
    outputToken: z.string().includes('.'),
    amountIn: z
        .string()
        .regex(/^\d+$/i, { message: 'amountIn must be integer numeric string' })
        .refine((v) => BigInt(v) > 0n, { message: 'amountIn must be positive' }),
    targetPrice: z
        .string()
        .regex(/^\d+(?:\.\d{1,18})?$/i, { message: 'targetPrice must be numeric with up to 18 decimals' })
        .refine((v) => Number(v) > 0, { message: 'targetPrice must be positive' }),
    direction: z.enum(['lt', 'gt']),
    conditionToken: z.string().includes('.'),
    recipient: z.string().min(3),
    signature: z.string().length(130),
    uuid: z.string().uuid(),
});

const BLAZE_CONTRACT_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const BLAZE_CONTRACT_NAME = 'blaze-v1';
const MULTIHOP_CONTRACT_ID = process.env.MULTIHOP_CONTRACT_ID ?? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = schema.parse(body);

        if (!parsed.recipient) {
            parsed.recipient = parsed.owner;
        }

        // ----- Signature Verification (Stacks-based) -----
        try {
            const response = await callReadOnlyFunction(
                BLAZE_CONTRACT_ADDRESS,
                BLAZE_CONTRACT_NAME,
                'recover',
                [
                    bufferFromHex(parsed.signature),
                    principalCV(parsed.inputToken),
                    stringAsciiCV('TRANSFER_TOKENS'),
                    noneCV(),
                    optionalCVOf(uintCV(BigInt(parsed.amountIn))),
                    optionalCVOf(principalCV(MULTIHOP_CONTRACT_ID)),
                    stringAsciiCV(parsed.uuid),
                ],
            );

            if (!response || typeof response.value !== 'string' || response.value !== parsed.owner) {
                return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
            }
        } catch (verErr) {
            console.error('Signature verify error', verErr);
            return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
        }

        const order = await addOrder(parsed);
        return NextResponse.json({ status: 'success', data: order });
    } catch (err) {
        console.error('Create order error', err);
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
} 