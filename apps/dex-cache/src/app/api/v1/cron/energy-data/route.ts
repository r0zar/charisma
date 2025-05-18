import { NextResponse } from 'next/server';
import { runEnergyDataProcessingForAllContracts } from '@/lib/server/energy';
import { processAllEnergyData } from '@/lib/energy/analytics';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * This handler will be invoked by a cron job to refresh analytics data.
 * It now delegates the core processing to a function in energy.ts.
 */
export async function GET(request: Request) {
    try {
        // 1. Authorize the request
        const authHeader = request.headers.get('authorization');
        if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log("Cron API route invoked, delegating to energy service...");
        const processingOutcome = await runEnergyDataProcessingForAllContracts();

        // The runEnergyDataProcessingForAllContracts function already logs details.
        // We just return its outcome.
        if (!processingOutcome.success && processingOutcome.error) {
            // If there was a major issue reported by the processing function itself
            return NextResponse.json(processingOutcome, { status: 500 });
        }

        return NextResponse.json(processingOutcome);

    } catch (error) {
        // This catch block handles unexpected errors in this route handler itself.
        console.error('Error in energy data collection cron API route:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal Server Error in API Route',
            message: process.env.NODE_ENV === 'development' ? error?.toString() : undefined
        }, { status: 500 });
    }
}

/**
 * Endpoint to manually add a contract to the monitoring list.
 * This logic remains here as it directly manipulates the KV store for monitored contracts.
 */
export async function POST(request: Request) {
    try {
        // This could be protected with admin authentication
        const { contractId } = await request.json();
        const kv = (await import('@vercel/kv')).kv; // Dynamically import kv for POST/DELETE
        const getEnergyContractsKey = () => `energy:monitored_contracts`; // Local helper
        const getEnergyAnalyticsCacheKey = (contractId: string) => `energy:analytics:${contractId}`;

        if (!contractId || typeof contractId !== 'string' || !contractId.includes('.')) {
            return NextResponse.json({ error: 'Valid contractId is required' }, { status: 400 });
        }

        const currentList = await kv.get<string[]>(getEnergyContractsKey()) || [];

        if (currentList.includes(contractId)) {
            return NextResponse.json({
                success: true,
                message: 'Contract already in monitoring list',
                contracts: currentList
            });
        }

        const newList = [...currentList, contractId];
        await kv.set(getEnergyContractsKey(), newList);

        // Immediately collect data for the new contract
        console.log(`POST: Processing analytics for newly added contract ${contractId}`);
        const data = await processAllEnergyData(contractId, undefined);
        const cacheKey = getEnergyAnalyticsCacheKey(contractId);
        await kv.set(cacheKey, data, { ex: 60 * 60 * 2 });

        return NextResponse.json({
            success: true,
            message: 'Contract added to monitoring list',
            contracts: newList
        });
    } catch (error) {
        console.error('Error adding contract to monitoring:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal Server Error'
        }, { status: 500 });
    }
}

/**
 * Endpoint to remove a contract from the monitoring list.
 * This logic remains here as it directly manipulates the KV store for monitored contracts.
 */
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contractId = searchParams.get('contractId');
        const kv = (await import('@vercel/kv')).kv; // Dynamically import kv
        const getEnergyContractsKey = () => `energy:monitored_contracts`; // Local helper

        if (!contractId) {
            return NextResponse.json({ error: 'contractId parameter is required' }, { status: 400 });
        }

        const currentList = await kv.get<string[]>(getEnergyContractsKey()) || [];

        if (!currentList.includes(contractId)) {
            return NextResponse.json({
                success: true,
                message: 'Contract not in monitoring list',
                contracts: currentList
            });
        }

        const newList = currentList.filter(id => id !== contractId);
        await kv.set(getEnergyContractsKey(), newList);

        return NextResponse.json({
            success: true,
            message: 'Contract removed from monitoring list',
            contracts: newList
        });
    } catch (error) {
        console.error('Error removing contract from monitoring:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal Server Error'
        }, { status: 500 });
    }
}