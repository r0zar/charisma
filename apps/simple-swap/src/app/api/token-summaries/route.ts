import { listTokenSummaries } from '@/app/token-actions';
import { NextResponse } from 'next/server';

export async function GET() {
    const summaries = await listTokenSummaries();
    return NextResponse.json(summaries);
}

export const revalidate = 60; // cache this route for 1 minute 