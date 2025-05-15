import { listTokenSummaries } from '@/app/token-actions';
import { NextResponse } from 'next/server';

// increase timeout to 5 minutes
export const maxDuration = 300;

export async function GET() {
    const summaries = await listTokenSummaries();
    return NextResponse.json(summaries);
}

export const revalidate = 60; // cache this route for 1 minute 