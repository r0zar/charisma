import { listTokenSummaries } from '@/app/token-actions';
import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { perfMonitor } from '@/lib/performance-monitor';

// increase timeout to 5 minutes
export const maxDuration = 300;

const CACHE_KEY = 'token-summaries';
const CACHE_TTL = 60; // 1 minute TTL

export async function GET() {
    const timer = perfMonitor.startTiming('token-summaries-api');
    
    try {
        // Try to get from Redis cache first
        const cached = await kv.get(CACHE_KEY);
        if (cached) {
            console.log('[TOKEN-SUMMARIES-API] Cache hit, returning cached data');
            timer.end({ 
                source: 'cache',
                tokenCount: Array.isArray(cached) ? cached.length : 0
            });
            return NextResponse.json(cached);
        }

        console.log('[TOKEN-SUMMARIES-API] Cache miss, fetching fresh data');
        
        // Fetch fresh data
        const summaries = await listTokenSummaries();
        
        // Cache the result
        await kv.setex(CACHE_KEY, CACHE_TTL, summaries);
        
        timer.end({ 
            source: 'fresh',
            tokenCount: summaries.length,
            cached: true
        });
        
        return NextResponse.json(summaries);
        
    } catch (error) {
        console.error('[TOKEN-SUMMARIES-API] Error:', error);
        timer.end({ 
            source: 'error',
            error: error.message 
        });
        
        // Try to return stale cache data if available
        try {
            const staleCache = await kv.get(CACHE_KEY);
            if (staleCache) {
                console.log('[TOKEN-SUMMARIES-API] Returning stale cache due to error');
                return NextResponse.json(staleCache);
            }
        } catch (cacheError) {
            console.error('[TOKEN-SUMMARIES-API] Cache read error:', cacheError);
        }
        
        return NextResponse.json({ error: 'Failed to fetch token summaries' }, { status: 500 });
    }
}

export const revalidate = 60; // cache this route for 1 minute 