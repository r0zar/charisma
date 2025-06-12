import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NewPerpetualPositionRequest } from '@/lib/perps/types';
import { addPosition } from '@/lib/perps/store';
import { callReadOnlyFunction } from '@repo/polyglot';
import { bufferFromHex } from '@stacks/transactions/dist/cl';
import {
    principalCV,
    stringAsciiCV,
    uintCV,
    noneCV,
    optionalCVOf,
} from '@stacks/transactions';

const schema = z.object({
    owner: z.string().min(3),
    tradingPair: z.string().min(3),
    direction: z.enum(['long', 'short']),
    positionSize: z.string().regex(/^\d+(?:\.\d{1,8})?$/, { message: 'positionSize must be numeric with up to 8 decimals' }),
    leverage: z.number().min(1).max(100),
    triggerPrice: z.string().regex(/^\d+(?:\.\d{1,8})?$/, { message: 'triggerPrice must be numeric with up to 8 decimals' }),
    stopLoss: z.string().regex(/^\d+(?:\.\d{1,8})?$/).optional(),
    takeProfit: z.string().regex(/^\d+(?:\.\d{1,8})?$/).optional(),
    signature: z.string().min(1), // Relaxed for preview mode
    uuid: z.string().uuid(),
    baseAsset: z.string().includes('.'),
    baseToken: z.string().includes('.'),
}).passthrough();

const BLAZE_CONTRACT_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const BLAZE_CONTRACT_NAME = 'blaze-v1';
const MULTIHOP_CONTRACT_ID = process.env.MULTIHOP_CONTRACT_ID ?? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9';

// Backend calculation functions for security
function calculateMarginRequired(positionSize: string, leverage: number): string {
    const size = parseFloat(positionSize);
    const margin = size / leverage;
    return margin.toFixed(8);
}

function calculateLiquidationPrice(triggerPrice: string, leverage: number, direction: 'long' | 'short'): string {
    const entry = parseFloat(triggerPrice);
    if (entry <= 0 || leverage <= 0) return '0';

    // Simplified liquidation calculation with 90% of max loss to account for fees
    const maxLossRatio = (1 / leverage) * 0.9;

    let liquidationPrice: number;
    if (direction === 'long') {
        liquidationPrice = entry * (1 - maxLossRatio);
    } else {
        liquidationPrice = entry * (1 + maxLossRatio);
    }

    return liquidationPrice.toFixed(8);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = schema.parse(body);

        // ----- Backend Risk Calculations (SECURE) -----
        const marginRequired = calculateMarginRequired(parsed.positionSize, parsed.leverage);
        const liquidationPrice = calculateLiquidationPrice(parsed.triggerPrice, parsed.leverage, parsed.direction);

        // Validate calculated values are reasonable
        const positionSize = parseFloat(parsed.positionSize);
        const margin = parseFloat(marginRequired);
        const liquidation = parseFloat(liquidationPrice);
        const trigger = parseFloat(parsed.triggerPrice);

        if (margin <= 0 || liquidation <= 0 || trigger <= 0) {
            return NextResponse.json({ error: 'Invalid calculated values' }, { status: 400 });
        }

        // Validate leverage is within acceptable range for liquidation
        if (parsed.leverage > 100) {
            return NextResponse.json({ error: 'Leverage too high' }, { status: 400 });
        }

        // Build complete position request with server-calculated values
        const completeRequest: NewPerpetualPositionRequest = {
            ...parsed,
            marginRequired,
            liquidationPrice,
        };

        console.log(`🛡️ Server calculated values for ${parsed.uuid}:`, {
            positionSize: parsed.positionSize,
            leverage: parsed.leverage,
            triggerPrice: parsed.triggerPrice,
            marginRequired,
            liquidationPrice,
            direction: parsed.direction
        });

        // ----- Signature Verification (DISABLED FOR PREVIEW MODE) -----
        console.log('⚠️ Signature verification disabled for preview mode');

        // TODO: Re-enable signature verification for production
        // try {
        //     // Convert position size to micro units for signature verification
        //     const positionSizeMicro = Math.floor(parseFloat(parsed.positionSize) * 1_000_000).toString();
        //     
        //     const response = await callReadOnlyFunction(
        //         BLAZE_CONTRACT_ADDRESS,
        //         BLAZE_CONTRACT_NAME,
        //         'recover',
        //         [
        //             bufferFromHex(parsed.signature),
        //             principalCV(parsed.baseToken), // Use base token for verification
        //             stringAsciiCV('PERPETUAL_POSITION'),
        //             noneCV(),
        //             optionalCVOf(uintCV(BigInt(positionSizeMicro))),
        //             optionalCVOf(principalCV(MULTIHOP_CONTRACT_ID)),
        //             stringAsciiCV(parsed.uuid),
        //         ],
        //     );
        //
        //     if (!response || typeof response.value !== 'string' || response.value !== parsed.owner) {
        //         return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
        //     }
        // } catch (verErr) {
        //     console.error('Signature verify error', verErr);
        //     return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
        // }

        const position = await addPosition(completeRequest);
        return NextResponse.json({ status: 'success', data: position });
    } catch (err) {
        console.error('Create perp position error', err);
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
} 