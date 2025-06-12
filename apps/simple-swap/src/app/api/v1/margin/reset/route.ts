import { NextResponse } from 'next/server';
import { resetMarginAccount } from '@/lib/margin/store';
import { z } from 'zod';

const resetSchema = z.object({
    owner: z.string().min(1)
});

// POST /api/v1/margin/reset - Reset margin account
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = resetSchema.parse(body);

        const account = await resetMarginAccount(parsed.owner);
        return NextResponse.json({ status: 'success', data: account });
    } catch (err) {
        console.error('Reset margin account error', err);
        const message = err instanceof Error ? err.message : 'Failed to reset margin account';
        return NextResponse.json({ error: message }, { status: 500 });
    }
} 