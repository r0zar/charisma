import { NextRequest, NextResponse } from 'next/server';
import { kv } from "@vercel/kv";

const getCronLastRunKey = () => `energy:cron:last_run`;
const getCronStatusKey = () => `energy:cron:status`;

export async function GET(request: NextRequest) {
    try {
        const [lastRun, status] = await Promise.all([
            kv.get(getCronLastRunKey()),
            kv.get(getCronStatusKey())
        ]);
        
        const processingStatus = {
            isRunning: false,
            lastRun: lastRun ? Number(lastRun) : 0,
            duration: status ? (status as any).duration || 0 : 0,
            processedContracts: status ? (status as any).contractsProcessed || 0 : 0,
            errors: status ? (status as any).errors || [] : []
        };
        
        return NextResponse.json(processingStatus);
    } catch (error) {
        console.error("Error in energy processing status API:", error);
        return NextResponse.json(
            { 
                error: "Failed to fetch processing status",
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}