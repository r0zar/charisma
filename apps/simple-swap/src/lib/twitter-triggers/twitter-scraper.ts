import { TwitterReply, TwitterScrapingResult } from './types';
import { Scraper, SearchMode, ErrorRateLimitStrategy } from '@the-convocation/twitter-scraper';


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
    const maxRetries = 2;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Twitter Scraper] Scraping replies for tweet ${tweetId}${sinceId ? ` since ${sinceId}` : ''} (attempt ${attempt}/${maxRetries})`);

            const result = await Promise.race([
                scrapeWithTimeout(tweetId, sinceId, 30000), // 30 second timeout
                new Promise<TwitterScrapingResult>((_, reject) =>
                    setTimeout(() => reject(new Error('Scraping timeout after 30 seconds')), 30000)
                )
            ]);

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

        } catch (timeoutError) {
            console.warn(`[Twitter Scraper] Attempt ${attempt} timed out for tweet ${tweetId}`);

            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                console.log(`[Twitter Scraper] Waiting ${delay}ms before retry ${attempt + 1}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            return {
                success: false,
                replies: [],
                error: 'Scraping timed out after multiple attempts',
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
 * Internal scraping function with timeout
 */
async function scrapeWithTimeout(tweetId: string, sinceId?: string, timeoutMs: number = 30000): Promise<TwitterScrapingResult> {
    try {
        console.log(`[Twitter Scraper] Using @the-convocation/twitter-scraper for tweet ${tweetId}`);

        // Initialize scraper with CORS proxy (only in production) and rate limiting
        const isProduction = process.env.NODE_ENV === 'production';
        const scraper = new Scraper({
            // Add CORS proxy for serverless environments (production only)
            ...(isProduction && {
                transform: {
                    request(input: RequestInfo | URL, init?: RequestInit) {
                        if (input instanceof URL) {
                            const proxy = "https://corsproxy.io/?" +
                                encodeURIComponent(input.toString());
                            return [proxy, init];
                        } else if (typeof input === "string") {
                            const proxy = "https://corsproxy.io/?" +
                                encodeURIComponent(input);
                            return [proxy, init];
                        }
                        return [input, init];
                    },
                }
            }),
            // Use error strategy instead of waiting up to 13 minutes for rate limits
            rateLimitStrategy: new ErrorRateLimitStrategy(),
        });

        // Check credentials
        const USERNAME = process.env.TWITTER_USERNAME;
        const PASSWORD = process.env.TWITTER_PASSWORD;

        console.log(`[Twitter Scraper] Checking credentials:`, {
            hasUsername: !!USERNAME,
            hasPassword: !!PASSWORD,
            usernameLength: USERNAME?.length || 0,
            passwordLength: PASSWORD?.length || 0
        });

        // Optional: Login with credentials if available
        if (USERNAME && PASSWORD) {
            console.log(`[Twitter Scraper] Logging in with credentials for user: ${USERNAME}`);
            try {
                await scraper.login(USERNAME, PASSWORD);
                console.log(`[Twitter Scraper] Login successful`);
            } catch (loginError) {
                console.error(`[Twitter Scraper] Login failed:`, loginError);

                // Check for specific error types
                const errorMessage = loginError instanceof Error ? loginError.message : 'Unknown login error';
                if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
                    console.warn(`[Twitter Scraper] Rate limited during login. Will retry without authentication.`);
                } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
                    console.warn(`[Twitter Scraper] Authentication failed. Check credentials. Will proceed without login.`);
                } else if (errorMessage.includes('Missing data')) {
                    console.warn(`[Twitter Scraper] Twitter API returned missing data error. This may indicate rate limiting or credential issues.`);
                }

                // Continue without login - some scraping might still work in guest mode
                console.log(`[Twitter Scraper] Proceeding without authentication`);
            }
        } else {
            console.log(`[Twitter Scraper] No credentials provided, proceeding without login`);
        }

        // Search for replies to the specific tweet using conversation search
        console.log(`[Twitter Scraper] Searching for replies to tweet ${tweetId}`);
        const searchQuery = `conversation_id:${tweetId}`;
        console.log(`[Twitter Scraper] Search query: "${searchQuery}"`);

        const formattedReplies: TwitterReply[] = [];
        let processedCount = 0;

        // Search for tweets in the conversation (replies)
        console.log(`[Twitter Scraper] Starting search with max 100 results`);
        const tweets = scraper.searchTweets(searchQuery, 100, SearchMode.Latest);

        let tweetCount = 0;
        for await (const tweet of tweets) {
            tweetCount++;
            console.log(`[Twitter Scraper] Processing tweet ${tweetCount}:`, {
                id: tweet.id,
                username: tweet.username,
                isReply: tweet.isReply,
                inReplyToStatusId: tweet.inReplyToStatusId,
                text: tweet.text?.substring(0, 50) + '...'
            });

            // Skip if we have a sinceId and this reply is older
            if (sinceId && tweet.id && tweet.id <= sinceId) {
                console.log(`[Twitter Scraper] Skipping tweet ${tweet.id} - older than sinceId ${sinceId}`);
                continue;
            }

            // Skip the original tweet (it won't be a reply)
            if (tweet.id === tweetId) {
                console.log(`[Twitter Scraper] Skipping original tweet ${tweet.id}`);
                continue;
            }

            // Only include actual replies
            if (tweet.isReply && tweet.inReplyToStatusId) {
                console.log(`[Twitter Scraper] Found valid reply ${tweet.id} from @${tweet.username}`);

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
                    console.log(`[Twitter Scraper] Reached processing limit of 100 replies`);
                    break;
                }
            } else {
                console.log(`[Twitter Scraper] Skipping tweet ${tweet.id} - not a reply (isReply: ${tweet.isReply}, inReplyToStatusId: ${tweet.inReplyToStatusId})`);
            }
        }

        console.log(`[Twitter Scraper] Search completed. Processed ${tweetCount} total tweets, found ${formattedReplies.length} valid replies`);

        return {
            success: true,
            replies: formattedReplies,
            lastScrapedAt: new Date().toISOString(),
        };

    } catch (scraperError) {
        console.error(`[Twitter Scraper] Scraper error for tweet ${tweetId}:`, scraperError);

        // Enhanced error handling for different types of failures
        const errorMessage = scraperError instanceof Error ? scraperError.message : 'Twitter scraping failed';
        let enhancedError = errorMessage;

        if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
            enhancedError = 'Twitter rate limit exceeded. Please wait before retrying.';
            console.warn(`[Twitter Scraper] Rate limit encountered for tweet ${tweetId}`);
        } else if (errorMessage.includes('not logged-in') || errorMessage.includes('AuthenticationError')) {
            enhancedError = 'Twitter authentication required for this operation.';
            console.warn(`[Twitter Scraper] Authentication required for tweet ${tweetId}`);
        } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
            enhancedError = 'Access forbidden. Tweet may be private or account suspended.';
            console.warn(`[Twitter Scraper] Access forbidden for tweet ${tweetId}`);
        } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
            enhancedError = 'Tweet not found. It may have been deleted.';
            console.warn(`[Twitter Scraper] Tweet ${tweetId} not found`);
        } else if (errorMessage.includes('Missing data')) {
            enhancedError = 'Twitter API returned incomplete data. This may indicate rate limiting.';
            console.warn(`[Twitter Scraper] Incomplete data for tweet ${tweetId}`);
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