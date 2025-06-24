import { NextRequest, NextResponse } from 'next/server';
import { scrapeTwitterReplies } from '@/lib/twitter-triggers/twitter-scraper';
import { validateTweetUrl } from '@/lib/twitter-triggers/twitter-scraper';

// POST /api/v1/twitter-triggers/testing/scrape-tweet - Test Twitter scraping
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tweetUrl } = body;
        
        if (!tweetUrl) {
            return NextResponse.json({
                success: false,
                error: 'tweetUrl is required'
            }, { status: 400 });
        }

        // Validate tweet URL
        const urlValidation = validateTweetUrl(tweetUrl);
        if (!urlValidation.valid) {
            return NextResponse.json({
                success: false,
                error: urlValidation.error
            }, { status: 400 });
        }

        const tweetId = urlValidation.tweetId!;
        
        console.log(`[Testing API] Testing Twitter scraping for tweet ${tweetId}`);
        
        // Scrape the tweet for replies
        const scrapingResult = await scrapeTwitterReplies(tweetId);
        
        // Return detailed results
        return NextResponse.json({
            success: true,
            data: {
                tweetId,
                tweetUrl,
                scrapingResult,
                testedAt: new Date().toISOString(),
                // Additional debugging info
                debugInfo: {
                    urlValidation,
                    totalReplies: scrapingResult.replies?.length || 0,
                    scrapingSuccess: scrapingResult.success
                }
            }
        });
        
    } catch (error) {
        console.error('[Testing API] Error testing Twitter scraping:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to test Twitter scraping',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}