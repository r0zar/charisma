import { NextResponse } from 'next/server';
import { getMarginAccount, depositMargin } from '@/lib/margin/store';
import { z } from 'zod';

const depositSchema = z.object({
    owner: z.string().min(1),
    amount: z.number().min(0.01).max(1000000)
});

// GET /api/v1/margin?owner=<address> - Get margin account
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const owner = searchParams.get('owner');

        if (!owner) {
            return NextResponse.json({ error: 'Owner address is required' }, { status: 400 });
        }

        const account = await getMarginAccount(owner);
        return NextResponse.json({ status: 'success', data: account });
    } catch (err) {
        console.error('Get margin account error', err);
        return NextResponse.json({ error: 'Failed to fetch margin account' }, { status: 500 });
    }
}

// POST /api/v1/margin - Deposit margin
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = depositSchema.parse(body);

        const account = await depositMargin(parsed);
        return NextResponse.json({ status: 'success', data: account });
    } catch (err) {
        console.error('Deposit margin error', err);
        const message = err instanceof Error ? err.message : 'Failed to deposit margin';
        return NextResponse.json({ error: message }, { status: 400 });
    }
} 