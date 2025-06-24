import { TwitterReply, TwitterScrapingResult } from './types';
import { ApifyClient } from 'apify-client';

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
 * Scrapes replies to a tweet using Apify's Web Harvester Twitter scraper
 * Note: sinceId parameter is kept for compatibility but not used - returns all replies for safety
 */
export async function scrapeTwitterReplies(tweetId: string, sinceId?: string): Promise<TwitterScrapingResult> {
    const maxRetries = 2;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Twitter Scraper] Scraping all replies for tweet ${tweetId} (attempt ${attempt}/${maxRetries})`);

            const result = await scrapeWithApify(tweetId);

            if (result.success) {
                return result;
            }

            // If not the last attempt and we got a rate limit error, wait before retry
            if (attempt < maxRetries && result.error?.includes('Rate limit')) {
                const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`[Twitter Scraper] Rate limited, waiting ${delay}ms before retry ${attempt + 1}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            return result;

        } catch (error) {
            console.warn(`[Twitter Scraper] Attempt ${attempt} failed for tweet ${tweetId}:`, error);

            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                console.log(`[Twitter Scraper] Waiting ${delay}ms before retry ${attempt + 1}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            return {
                success: false,
                replies: [],
                error: 'Scraping failed after multiple attempts',
                lastScrapedAt: new Date().toISOString(),
            };
        }
    }

    return {
        success: false,
        replies: [],
        error: 'Max retries exceeded',
        lastScrapedAt: new Date().toISOString(),
    };
}

/**
 * Internal scraping function using Apify
 */
async function scrapeWithApify(tweetId: string): Promise<TwitterScrapingResult> {
    try {
        console.log(`[Twitter Scraper] Using Apify Web Harvester for tweet ${tweetId}`);

        // Check for Apify token
        const APIFY_TOKEN = process.env.APIFY_TOKEN;
        if (!APIFY_TOKEN) {
            throw new Error('APIFY_TOKEN environment variable is required');
        }

        // Initialize Apify client
        const client = new ApifyClient({
            token: APIFY_TOKEN,
        });

        // Construct the tweet URL for Apify
        const tweetUrl = `https://x.com/tweet/status/${tweetId}`;
        
        // Configure Apify scraper for this specific tweet's replies
        const twitterConfig = {
            "includeUserInfo": true,
            "profilesDesired": 0, // We don't need user profiles
            "proxyConfig": {
                "useApifyProxy": true,
                "apifyProxyGroups": [
                    "RESIDENTIAL"
                ]
            },
            "repliesDepth": 1, // Only direct replies
            "startUrls": [
                {
                    "url": tweetUrl,
                    "method": "GET"
                }
            ],
            "storeUserIfNoTweets": false,
            "tweetsDesired": 100, // Match current behavior
            "withReplies": true // This is key - we want the replies
        };

        console.log(`[Twitter Scraper] Starting Apify scraper for URL: ${tweetUrl}`);

        // Run the Web Harvester Twitter scraper
        const run = await client.actor('web.harvester/twitter-scraper').call(twitterConfig);
        
        console.log(`[Twitter Scraper] Apify run completed with status: ${run.status}, ID: ${run.id}`);

        if (run.status !== 'SUCCEEDED') {
            throw new Error(`Apify run failed with status: ${run.status}`);
        }

        // Get the results from the dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        console.log(`[Twitter Scraper] Retrieved ${items.length} items from Apify`);
        console.log(`[Twitter Scraper] Raw Apify Response:`, JSON.stringify(items, null, 2));

        // Filter and format the replies
        const formattedReplies: TwitterReply[] = [];
        let processedCount = 0;

        for (const item of items) {
            // Type assertion for the item - Apify returns unknown
            const tweet = item as any;
            
            console.log(`[Twitter Scraper] Processing item:`, {
                id: tweet.id,
                isReply: tweet.isReply,
                username: tweet.username,
                fullname: tweet.fullname,
                text: tweet.text?.substring(0, 100),
                timestamp: tweet.timestamp,
                mainTweetUrl: tweet.mainTweetUrl
            });
            
            // Skip the original tweet
            if (tweet.id === tweetId) {
                console.log(`[Twitter Scraper] Skipping original tweet ${tweet.id}`);
                continue;
            }

            // Note: We now get all replies instead of filtering by sinceId for safety
            // This ensures we don't miss any replies due to ID comparison issues

            // Check if this is a reply based on Apify's structure
            const isValidReply = tweet.isReply === true || 
                                (tweet.mainTweetUrl && tweet.mainTweetUrl.includes(tweetId)) ||
                                (tweet.replyToTweet && tweet.replyToTweet.id === tweetId);

            if (isValidReply) {
                console.log(`[Twitter Scraper] Found valid reply ${tweet.id} from ${tweet.username}`);
                console.log(`[Twitter Scraper] Reply text: "${tweet.text}"`);
                console.log(`[Twitter Scraper] Author fullname: "${tweet.fullname}"`);

                formattedReplies.push({
                    id: String(tweet.id || `reply_${processedCount}`),
                    text: String(tweet.text || ''),
                    authorHandle: String(tweet.username || 'unknown').replace('@', ''), // Remove @ prefix
                    authorDisplayName: String(tweet.fullname || 'Unknown User'),
                    createdAt: String(tweet.timestamp || new Date().toISOString()),
                    inReplyToTweetId: tweetId,
                });

                processedCount++;

                // Limit results to prevent excessive processing
                if (processedCount >= 100) {
                    console.log(`[Twitter Scraper] Reached processing limit of 100 replies`);
                    break;
                }
            } else {
                console.log(`[Twitter Scraper] Skipping item ${tweet.id} - not a reply (isReply: ${tweet.isReply}, mainTweetUrl: ${tweet.mainTweetUrl})`);
            }
        }

        console.log(`[Twitter Scraper] Apify scraping completed. Found ${formattedReplies.length} valid replies`);

        return {
            success: true,
            replies: formattedReplies,
            lastScrapedAt: new Date().toISOString(),
        };

    } catch (scraperError) {
        console.error(`[Twitter Scraper] Apify scraper error for tweet ${tweetId}:`, scraperError);

        // Enhanced error handling for different types of failures
        const errorMessage = scraperError instanceof Error ? scraperError.message : 'Twitter scraping failed';
        let enhancedError = errorMessage;

        if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
            enhancedError = 'Twitter rate limit exceeded. Please wait before retrying.';
            console.warn(`[Twitter Scraper] Rate limit encountered for tweet ${tweetId}`);
        } else if (errorMessage.includes('APIFY_TOKEN')) {
            enhancedError = 'Apify authentication failed. Check APIFY_TOKEN environment variable.';
            console.warn(`[Twitter Scraper] Apify authentication failed for tweet ${tweetId}`);
        } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
            enhancedError = 'Access forbidden. Tweet may be private or account suspended.';
            console.warn(`[Twitter Scraper] Access forbidden for tweet ${tweetId}`);
        } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
            enhancedError = 'Tweet not found. It may have been deleted.';
            console.warn(`[Twitter Scraper] Tweet ${tweetId} not found`);
        } else if (errorMessage.includes('FAILED') || errorMessage.includes('failed')) {
            enhancedError = 'Apify scraper run failed. This may indicate rate limiting or temporary issues.';
            console.warn(`[Twitter Scraper] Apify run failed for tweet ${tweetId}`);
        }

        return {
            success: false,
            replies: [],
            error: enhancedError,
            lastScrapedAt: new Date().toISOString(),
        };
    }
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