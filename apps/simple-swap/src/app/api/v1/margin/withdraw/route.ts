import { NextResponse } from 'next/server';
import { withdrawMargin } from '@/lib/margin/store';
import { z } from 'zod';

const withdrawSchema = z.object({
    owner: z.string().min(1),
    amount: z.number().min(0.01).max(1000000)
});

// POST /api/v1/margin/withdraw - Withdraw margin
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = withdrawSchema.parse(body);

        const account = await withdrawMargin(parsed);
        return NextResponse.json({ status: 'success', data: account });
    } catch (err) {
        console.error('Withdraw margin error', err);
        const message = err instanceof Error ? err.message : 'Failed to withdraw margin';
        return NextResponse.json({ error: message }, { status: 400 });
    }
} 