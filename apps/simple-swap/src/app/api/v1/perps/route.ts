import { NextResponse } from 'next/server';
import { listPositions } from '@/lib/perps/store';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const owner = searchParams.get('owner') || undefined;
        const positions = await listPositions(owner);
        return NextResponse.json({ status: 'success', data: positions });
    } catch (err) {
        console.error('Perps list error', err);
        return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 });
    }
} 