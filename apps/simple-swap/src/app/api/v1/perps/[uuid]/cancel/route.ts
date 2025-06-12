import { NextResponse } from 'next/server';
import { cancelPosition } from '@/lib/perps/store';
import { syncUserMarginAccountPnL } from '@/lib/margin/sync';

export async function POST(req: Request, { params }: { params: { uuid: string } }) {
    try {
        const { uuid } = await params;
        const position = await cancelPosition(uuid);
        if (!position) {
            return NextResponse.json({ error: 'Position not found or cannot be cancelled' }, { status: 404 });
        }

        // Sync margin account P&L after position cancellation
        await syncUserMarginAccountPnL(position.owner).catch(err => {
            console.warn(`Failed to sync P&L for user ${position.owner}:`, err);
        });

        return NextResponse.json({ status: 'success', data: position });
    } catch (err) {
        console.error('Cancel position error', err);
        return NextResponse.json({ error: 'Failed to cancel position' }, { status: 500 });
    }
} 