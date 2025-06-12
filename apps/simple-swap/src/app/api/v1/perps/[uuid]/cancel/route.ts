import { NextResponse } from 'next/server';
import { cancelPosition } from '@/lib/perps/store';

export async function POST(req: Request, { params }: { params: { uuid: string } }) {
    try {
        const { uuid } = await params;
        const position = await cancelPosition(uuid);
        if (!position) {
            return NextResponse.json({ error: 'Position not found or cannot be cancelled' }, { status: 404 });
        }
        return NextResponse.json({ status: 'success', data: position });
    } catch (err) {
        console.error('Cancel position error', err);
        return NextResponse.json({ error: 'Failed to cancel position' }, { status: 500 });
    }
} 