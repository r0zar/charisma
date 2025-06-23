import { TwitterReply, TwitterScrapingResult } from './types';

/**
 * Extracts tweet ID from various Twitter URL formats
 */
export function extractTweetId(tweetUrl: string): string | null {
    // Handle various Twitter URL formats:
    // https://twitter.com/username/status/1234567890
    // https://x.com/username/status/1234567890
    // https://mobile.twitter.com/username/status/1234567890
    const patterns = [
        /(?:twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/i,
        /status\/(\d+)/i,
    ];
    
    for (const pattern of patterns) {
        const match = tweetUrl.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
}

/**
 * Scrapes replies to a tweet using @the-convocation/twitter-scraper
 */
export async function scrapeTwitterReplies(tweetId: string, sinceId?: string): Promise<TwitterScrapingResult> {
    try {
        console.log(`[Twitter Scraper] Scraping replies for tweet ${tweetId}${sinceId ? ` since ${sinceId}` : ''}`);
        
        // Check if Twitter scraper is enabled (default to true for testing)
        const twitterScraperEnabled = process.env.TWITTER_SCRAPER_ENABLED !== 'false';
        
        if (!twitterScraperEnabled) {
            console.log(`[Twitter Scraper] Twitter scraper disabled, using mock data`);
            return getMockReplies(tweetId, sinceId);
        }
        
        try {
            // Use twitter-api-v2 for more reliable API access
            const { TwitterApi } = await import('twitter-api-v2');
            
            // Initialize Twitter API client with credentials
            const client = new TwitterApi({
                appKey: process.env.TWITTER_API_KEY!,
                appSecret: process.env.TWITTER_API_SECRET!,
                accessToken: process.env.TWITTER_ACCESS_TOKEN!,
                accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
            });
            
            console.log(`[Twitter Scraper] Using Twitter API v2 to get replies for tweet ${tweetId}`);
            
            // Get the original tweet to find its conversation ID
            const originalTweet = await client.v2.singleTweet(tweetId, {
                'tweet.fields': ['conversation_id', 'created_at', 'author_id']
            });
            
            if (!originalTweet.data) {
                throw new Error('Original tweet not found');
            }
            
            const conversationId = originalTweet.data.conversation_id || tweetId;
            
            // Search for tweets in the conversation (replies)
            console.log(`[Twitter Scraper] Searching conversation ${conversationId} for replies`);
            
            const searchQuery = `conversation_id:${conversationId} -from:${originalTweet.data.author_id}`;
            const searchResults = await client.v2.search(searchQuery, {
                'tweet.fields': ['created_at', 'conversation_id', 'in_reply_to_user_id'],
                'user.fields': ['username', 'name'],
                expansions: ['author_id'],
                max_results: 100,
                sort_order: 'recency'
            });
            
            const formattedReplies: TwitterReply[] = [];
            
            if (searchResults.data) {
                for (const tweet of searchResults.data.data || []) {
                    // Skip if we have a sinceId and this reply is older
                    if (sinceId && tweet.id <= sinceId) {
                        continue;
                    }
                    
                    // Find the user data for this tweet
                    const author = searchResults.data.includes?.users?.find(user => user.id === tweet.author_id);
                    
                    if (author) {
                        formattedReplies.push({
                            id: tweet.id,
                            text: tweet.text || '',
                            authorHandle: author.username || 'unknown',
                            authorDisplayName: author.name || 'Unknown User',
                            createdAt: tweet.created_at || new Date().toISOString(),
                            inReplyToTweetId: tweetId,
                        });
                    }
                }
            }
            
            console.log(`[Twitter Scraper] Found ${formattedReplies.length} replies for tweet ${tweetId}`);
            
            return {
                success: true,
                replies: formattedReplies,
                lastScrapedAt: new Date().toISOString(),
            };
            
        } catch (scraperError) {
            console.error(`[Twitter Scraper] Scraper error for tweet ${tweetId}:`, scraperError);
            
            // Return error instead of falling back to mock data
            return {
                success: false,
                replies: [],
                error: scraperError instanceof Error ? scraperError.message : 'Twitter scraping failed',
                lastScrapedAt: new Date().toISOString(),
            };
        }
        
    } catch (error) {
        console.error(`[Twitter Scraper] Error scraping replies for tweet ${tweetId}:`, error);
        return {
            success: false,
            replies: [],
            error: error instanceof Error ? error.message : 'Unknown scraping error',
            lastScrapedAt: new Date().toISOString(),
        };
    }
}

/**
 * Mock replies for testing when Twitter API is not available
 */
function getMockReplies(tweetId: string, sinceId?: string): TwitterScrapingResult {
    // Return empty replies when Twitter scraper is disabled
    return {
        success: true,
        replies: [],
        lastScrapedAt: new Date().toISOString(),
    };
}

/**
 * Validates if a tweet URL is properly formatted and accessible
 */
export function validateTweetUrl(url: string): { valid: boolean; error?: string; tweetId?: string } {
    try {
        const tweetId = extractTweetId(url);
        
        if (!tweetId) {
            return {
                valid: false,
                error: 'Could not extract tweet ID from URL. Please use a valid Twitter/X status URL.'
            };
        }
        
        // Additional validation
        if (!/^\d+$/.test(tweetId)) {
            return {
                valid: false,
                error: 'Invalid tweet ID format.'
            };
        }
        
        return {
            valid: true,
            tweetId
        };
        
    } catch (error) {
        return {
            valid: false,
            error: 'Invalid tweet URL format.'
        };
    }
}

/**
 * Rate limiting helper for Twitter API calls
 */
export class TwitterRateLimiter {
    private lastCall: number = 0;
    private minInterval: number;
    
    constructor(callsPerMinute: number = 30) {
        this.minInterval = (60 * 1000) / callsPerMinute; // Convert to milliseconds
    }
    
    async waitIfNeeded(): Promise<void> {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCall;
        
        if (timeSinceLastCall < this.minInterval) {
            const waitTime = this.minInterval - timeSinceLastCall;
            console.log(`[Rate Limiter] Waiting ${waitTime}ms before next Twitter API call`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastCall = Date.now();
    }
}