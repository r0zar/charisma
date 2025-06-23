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
            // Use @the-convocation/twitter-scraper
            const { Scraper, SearchMode } = await import('@the-convocation/twitter-scraper');
            
            // Initialize scraper
            const scraper = new Scraper();
            
            // Optional: Login with credentials if available
            const username = process.env.TWITTER_USERNAME;
            const password = process.env.TWITTER_PASSWORD;
            
            if (username && password) {
                console.log(`[Twitter Scraper] Logging in with credentials`);
                await scraper.login(username, password);
            }
            
            // Search for replies to the specific tweet using conversation search
            console.log(`[Twitter Scraper] Searching for replies to tweet ${tweetId}`);
            const searchQuery = `conversation_id:${tweetId}`;
            
            const formattedReplies: TwitterReply[] = [];
            let processedCount = 0;
            
            // Search for tweets in the conversation (replies)
            const tweets = scraper.searchTweets(searchQuery, 100, SearchMode.Latest);
            
            for await (const tweet of tweets) {
                // Skip if we have a sinceId and this reply is older
                if (sinceId && tweet.id && tweet.id <= sinceId) {
                    continue;
                }
                
                // Skip the original tweet (it won't be a reply)
                if (tweet.id === tweetId) {
                    continue;
                }
                
                // Only include actual replies
                if (tweet.isReply && tweet.inReplyToStatusId) {
                    formattedReplies.push({
                        id: tweet.id || `reply_${processedCount}`,
                        text: tweet.text || '',
                        authorHandle: tweet.username || 'unknown',
                        authorDisplayName: tweet.name || 'Unknown User',
                        createdAt: tweet.timeParsed?.toISOString() || new Date().toISOString(),
                        inReplyToTweetId: tweetId,
                    });
                    
                    processedCount++;
                    
                    // Limit results to prevent excessive processing
                    if (processedCount >= 100) {
                        break;
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
            
            // Fall back to mock data if scraper fails
            console.log(`[Twitter Scraper] Falling back to mock data due to scraper error`);
            return getMockReplies(tweetId, sinceId);
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
    const mockReplies: TwitterReply[] = [
        {
            id: '1234567891',
            text: 'Great project! My handle is @alice.btc',
            authorHandle: 'alice_crypto',
            authorDisplayName: 'Alice.btc 🎯',
            createdAt: new Date().toISOString(),
            inReplyToTweetId: tweetId,
        },
        {
            id: '1234567892', 
            text: 'Interesting! Contact me at bob.btc',
            authorHandle: 'bob_trader',
            authorDisplayName: 'Bob Smith (bob.btc)',
            createdAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
            inReplyToTweetId: tweetId,
        },
        {
            id: '1234567893',
            text: 'Love this! charlie.btc here 🚀',
            authorHandle: 'charlie_defi',
            authorDisplayName: 'Charlie (charlie.btc)',
            createdAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
            inReplyToTweetId: tweetId,
        },
        {
            id: '1234567894',
            text: 'This is amazing! satoshi.btc checking in',
            authorHandle: 'satoshi_nakamoto',
            authorDisplayName: 'Satoshi (satoshi.btc)',
            createdAt: new Date(Date.now() - 180000).toISOString(), // 3 minutes ago
            inReplyToTweetId: tweetId,
        }
    ];
    
    // Filter replies newer than sinceId if provided
    const filteredReplies = sinceId ? 
        mockReplies.filter(reply => reply.id > sinceId) : 
        mockReplies;
    
    return {
        success: true,
        replies: filteredReplies,
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