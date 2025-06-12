import { NextResponse } from 'next/server';
import { updateMarginUsage } from '@/lib/margin/store';
import { z } from 'zod';

const updateSchema = z.object({
    owner: z.string().min(1),
    usedMarginChange: z.number().optional(),
    unrealizedPnL: z.number().optional()
});

// POST /api/v1/margin/update - Update margin usage and/or P&L
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = updateSchema.parse(body);

        if (parsed.usedMarginChange === undefined && parsed.unrealizedPnL === undefined) {
            return NextResponse.json({
                error: 'Either usedMarginChange or unrealizedPnL must be provided'
            }, { status: 400 });
        }

        const account = await updateMarginUsage(parsed);
        return NextResponse.json({ status: 'success', data: account });
    } catch (err) {
        console.error('Update margin error', err);
        const message = err instanceof Error ? err.message : 'Failed to update margin';
        return NextResponse.json({ error: message }, { status: 400 });
    }
} 