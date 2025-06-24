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

        try {
            // Use @the-convocation/twitter-scraper (original working version)
            const { Scraper, SearchMode } = await import('@the-convocation/twitter-scraper');

            console.log(`[Twitter Scraper] Using @the-convocation/twitter-scraper for tweet ${tweetId}`);

            // Initialize scraper
            const scraper = new Scraper();

            // Check credentials
            const username = process.env.TWITTER_USERNAME;
            const password = process.env.TWITTER_PASSWORD;

            console.log(`[Twitter Scraper] Checking credentials:`, {
                hasUsername: !!username,
                hasPassword: !!password,
                usernameLength: username?.length || 0,
                passwordLength: password?.length || 0
            });

            // Optional: Login with credentials if available
            if (username && password) {
                console.log(`[Twitter Scraper] Logging in with credentials for user: ${username}`);
                try {
                    await scraper.login(username, password);
                    console.log(`[Twitter Scraper] Login successful`);
                } catch (loginError) {
                    console.error(`[Twitter Scraper] Login failed:`, loginError);
                    // Continue without login - some scraping might still work
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