import { NextResponse } from 'next/server';
import { perpsMonitor } from '@/lib/perps/monitor';

// This endpoint can be called by a cron job or manually to start monitoring
export async function GET(req: Request) {
    try {
        await perpsMonitor.start();
        return NextResponse.json({
            status: 'success',
            message: 'Perpetual positions monitor started'
        });
    } catch (err) {
        console.error('Failed to start perps monitor:', err);
        return NextResponse.json({
            error: 'Failed to start monitor'
        }, { status: 500 });
    }
}

// Allow manual stopping of the monitor
export async function DELETE(req: Request) {
    try {
        perpsMonitor.stop();
        return NextResponse.json({
            status: 'success',
            message: 'Perpetual positions monitor stopped'
        });
    } catch (err) {
        console.error('Failed to stop perps monitor:', err);
        return NextResponse.json({
            error: 'Failed to stop monitor'
        }, { status: 500 });
    }
}