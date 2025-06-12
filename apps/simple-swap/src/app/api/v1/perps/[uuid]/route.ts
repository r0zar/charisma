import { NextResponse } from 'next/server';
import { getPosition, cancelPosition } from '@/lib/perps/store';

export async function GET(req: Request, { params }: { params: { uuid: string } }) {
    try {
        const { uuid } = await params;
        const position = await getPosition(uuid);
        if (!position) {
            return NextResponse.json({ error: 'Position not found' }, { status: 404 });
        }
        return NextResponse.json({ status: 'success', data: position });
    } catch (err) {
        console.error('Get position error', err);
        return NextResponse.json({ error: 'Failed to fetch position' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { uuid: string } }) {
    try {
        const { uuid } = await params;
        const position = await cancelPosition(uuid);
        if (!position) {
            return NextResponse.json({ error: 'Position not found' }, { status: 404 });
        }
        return NextResponse.json({ status: 'success', data: position });
    } catch (err) {
        console.error('Cancel position error', err);
        return NextResponse.json({ error: 'Failed to cancel position' }, { status: 500 });
    }
} 