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
        .regex(/^[0-9]+$/i, { message: 'amountIn must be integer numeric string' })
        .refine((v) => BigInt(v) > 0n, { message: 'amountIn must be positive' }),
    targetPrice: z
        .string()
        .regex(/^\d+(?:\.\d{1,18})?$/i, { message: 'targetPrice must be numeric with up to 18 decimals' })
        .refine((v) => Number(v) >= 0, { message: 'targetPrice must be non-negative' })
        .optional(),
    direction: z.enum(['lt', 'gt']).optional(),
    conditionToken: z.string().refine(
        (val) => val === '*' || val.includes('.'), 
        { message: 'conditionToken must be a contract ID (contains ".") or "*" for immediate execution' }
    ).optional(),
    recipient: z.string().min(3),
    signature: z.string().length(130),
    uuid: z.string().uuid(),
    baseAsset: z.string().optional(),
    validFrom: z.string().datetime().optional(),
    validTo: z.string().datetime().optional(),
}).passthrough();

// Ensure validFrom < validTo when both provided, and validate condition fields consistency
const validatedSchema = schema.superRefine((data, ctx) => {
    // Validate time range
    if (data.validFrom && data.validTo) {
        const fromTs = Date.parse(data.validFrom);
        const toTs = Date.parse(data.validTo);
        if (Number.isNaN(fromTs) || Number.isNaN(toTs)) {
            // datetime() already validates format, extra guard
            return;
        }
        if (fromTs >= toTs) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'validTo must be later than validFrom',
            });
        }
    }

    // Validate condition fields consistency
    const hasConditionToken = !!data.conditionToken;
    const hasTargetPrice = !!data.targetPrice;
    const hasDirection = !!data.direction;

    // If any condition field is provided, all required condition fields must be provided
    if (hasConditionToken || hasTargetPrice || hasDirection) {
        if (!hasConditionToken) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'conditionToken is required when targetPrice or direction is provided',
                path: ['conditionToken']
            });
        }
        if (!hasTargetPrice) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'targetPrice is required when conditionToken or direction is provided',
                path: ['targetPrice']
            });
        }
        if (!hasDirection) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'direction is required when conditionToken or targetPrice is provided',
                path: ['direction']
            });
        }
    }
});

const BLAZE_CONTRACT_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const BLAZE_CONTRACT_NAME = 'blaze-v1';
const MULTIHOP_CONTRACT_ID = process.env.MULTIHOP_CONTRACT_ID ?? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = validatedSchema.parse(body);

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