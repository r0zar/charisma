import { TwitterTriggerExecution } from './types';
// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';

interface QueuedReply {
    id: string;
    tweetId: string;
    message: string;
    attempts: number;
    lastAttempt?: number;
    resolve: (result: { success: boolean; tweetId?: string; error?: string }) => void;
    reject: (error: Error) => void;
}

interface PersistedQueuedReply {
    id: string;
    tweetId: string;
    message: string;
    attempts: number;
    lastAttempt?: number;
    createdAt: number;
}

/**
 * Twitter reply service for sending notifications when orders are executed
 */
export class TwitterReplyService {
    private client: any; // TwitterApi instance
    private isLoggedIn = false;
    private loginPromise: Promise<void> | null = null;
    private replyQueue: QueuedReply[] = [];
    private isProcessingQueue = false;
    private rateLimitReset = 0;
    private requestCount = 0;
    private readonly maxRequestsPer24Hours = 17; // Twitter API v2 free tier limit
    private readonly maxRetries = 3;
    private readonly baseDelay = 1000; // 1 second base delay
    private readonly queueKey = 'twitter:reply:queue';
    private readonly rateLimitKey = 'twitter:reply:ratelimit';
    private isInitialized = false;

    constructor() {
        this.client = null;
        // Initialize from KV and start processing queue
        this.initializeFromKV();
    }

    /**
     * Initialize the service from KV storage
     */
    private async initializeFromKV(): Promise<void> {
        if (this.isInitialized) return;
        
        try {
            // Load rate limit state from KV
            const rateLimitData = await kv.get(this.rateLimitKey) as { requestCount: number; rateLimitReset: number } | null;
            if (rateLimitData) {
                this.requestCount = rateLimitData.requestCount;
                this.rateLimitReset = rateLimitData.rateLimitReset;
                console.log(`[Twitter Reply] Loaded rate limit state: ${this.requestCount}/${this.maxRequestsPer24Hours}, reset at ${new Date(this.rateLimitReset).toISOString()}`);
            } else {
                // Initialize rate limit reset time to 24 hours from now
                this.rateLimitReset = Date.now() + 24 * 60 * 60 * 1000;
                await this.saveRateLimitState();
            }

            // Load queue from KV
            const persistedQueue = await kv.lrange(this.queueKey, 0, -1) as PersistedQueuedReply[];
            console.log(`[Twitter Reply] Loading ${persistedQueue.length} items from persisted queue`);
            
            // Convert persisted queue items to in-memory queue items
            for (const persistedItem of persistedQueue) {
                this.replyQueue.push({
                    ...persistedItem,
                    resolve: () => {}, // Will be overwritten when processing
                    reject: () => {}   // Will be overwritten when processing
                });
            }

            this.isInitialized = true;
            console.log(`[Twitter Reply] Initialized with ${this.replyQueue.length} queued items`);
            
            // Start processing queue
            this.startQueueProcessor();
        } catch (error) {
            console.error('[Twitter Reply] Failed to initialize from KV:', error);
            // Fallback to default initialization
            this.rateLimitReset = Date.now() + 24 * 60 * 60 * 1000;
            this.isInitialized = true;
            this.startQueueProcessor();
        }
    }

    /**
     * Save rate limit state to KV
     */
    private async saveRateLimitState(): Promise<void> {
        try {
            await kv.set(this.rateLimitKey, {
                requestCount: this.requestCount,
                rateLimitReset: this.rateLimitReset
            });
        } catch (error) {
            console.error('[Twitter Reply] Failed to save rate limit state:', error);
        }
    }

    /**
     * Save queue item to KV
     */
    private async saveQueueItem(item: QueuedReply): Promise<void> {
        try {
            const persistedItem: PersistedQueuedReply = {
                id: item.id,
                tweetId: item.tweetId,
                message: item.message,
                attempts: item.attempts,
                lastAttempt: item.lastAttempt,
                createdAt: Date.now()
            };
            await kv.rpush(this.queueKey, persistedItem);
        } catch (error) {
            console.error('[Twitter Reply] Failed to save queue item:', error);
        }
    }

    /**
     * Remove queue item from KV
     */
    private async removeQueueItem(itemId: string): Promise<void> {
        try {
            // Get all items from the queue
            const queue = await kv.lrange(this.queueKey, 0, -1) as PersistedQueuedReply[];
            // Find the index of the item to remove
            const index = queue.findIndex(item => item.id === itemId);
            if (index >= 0) {
                // Remove the item by setting it to a placeholder and then removing the placeholder
                await kv.lset(this.queueKey, index, '__DELETE_MARKER__');
                await kv.lrem(this.queueKey, 1, '__DELETE_MARKER__');
            }
        } catch (error) {
            console.error('[Twitter Reply] Failed to remove queue item:', error);
        }
    }

    /**
     * Update queue item attempts in KV
     */
    private async updateQueueItemAttempts(itemId: string, attempts: number, lastAttempt?: number): Promise<void> {
        try {
            // Get all items from the queue
            const queue = await kv.lrange(this.queueKey, 0, -1) as PersistedQueuedReply[];
            // Find the index of the item to update
            const index = queue.findIndex(item => item.id === itemId);
            if (index >= 0) {
                const updatedItem = { ...queue[index], attempts, lastAttempt };
                await kv.lset(this.queueKey, index, updatedItem);
            }
        } catch (error) {
            console.error('[Twitter Reply] Failed to update queue item attempts:', error);
        }
    }

    /**
     * Initialize and login to Twitter
     */
    private async login(): Promise<void> {
        // Return existing login promise if already in progress
        if (this.loginPromise) {
            return this.loginPromise;
        }

        if (this.isLoggedIn) {
            return;
        }

        this.loginPromise = this._performLogin();
        return this.loginPromise;
    }

    private async _performLogin(): Promise<void> {
        try {
            console.log('[Twitter Reply] Initializing Twitter client...');
            
            // Use twitter-api-v2 for posting (requires API credentials)
            const { TwitterApi } = await import('twitter-api-v2');
            
            const apiKey = process.env.TWITTER_API_KEY;
            const apiSecret = process.env.TWITTER_API_SECRET;
            const accessToken = process.env.TWITTER_ACCESS_TOKEN;
            const accessSecret = process.env.TWITTER_ACCESS_SECRET;
            
            if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
                throw new Error('Twitter API credentials required: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET');
            }
            
            console.log(`[Twitter Reply] Initializing Twitter API client...`);
            
            // Create Twitter API client with credentials
            this.client = new TwitterApi({
                appKey: apiKey,
                appSecret: apiSecret,
                accessToken: accessToken,
                accessSecret: accessSecret,
            });
            
            this.isLoggedIn = true;
            console.log('[Twitter Reply] Successfully logged in to Twitter');
            
        } catch (error) {
            console.error('[Twitter Reply] Login failed:', error);
            this.isLoggedIn = false;
            this.loginPromise = null;
            throw error;
        }
    }

    /**
     * Start the queue processor that handles rate limiting
     */
    private startQueueProcessor(): void {
        if (this.isProcessingQueue) return;
        
        this.isProcessingQueue = true;
        this.processQueue();
    }

    /**
     * Process the reply queue with rate limiting
     */
    private async processQueue(): Promise<void> {
        while (this.isProcessingQueue) {
            if (this.replyQueue.length === 0) {
                // Wait a bit before checking again
                await this.delay(5000); // 5 seconds
                continue;
            }

            // Check if we've hit the daily rate limit
            if (this.requestCount >= this.maxRequestsPer24Hours) {
                const now = Date.now();
                const timeUntilReset = this.rateLimitReset - now;
                
                if (timeUntilReset > 0) {
                    console.log(`[Twitter Reply] Rate limit reached (${this.requestCount}/${this.maxRequestsPer24Hours}). Queue size: ${this.replyQueue.length}. Waiting ${Math.round(timeUntilReset / 1000 / 60)} minutes until reset`);
                    await this.delay(Math.min(timeUntilReset, 300000)); // Wait max 5 minutes at a time
                    continue;
                } else {
                    // Reset counter if 24 hours have passed
                    console.log(`[Twitter Reply] Rate limit period expired. Resetting counter from ${this.requestCount} to 0`);
                    this.requestCount = 0;
                    this.rateLimitReset = now + 24 * 60 * 60 * 1000; // 24 hours from now
                    await this.saveRateLimitState();
                }
            }

            const queuedReply = this.replyQueue.shift();
            if (!queuedReply) continue;

            console.log(`[Twitter Reply] Processing queued reply ${queuedReply.id}. Queue size: ${this.replyQueue.length}. Rate limit: ${this.requestCount}/${this.maxRequestsPer24Hours}`);

            try {
                const result = await this.sendReplyDirect(queuedReply.tweetId, queuedReply.message);
                this.requestCount++;
                await this.saveRateLimitState();
                
                if (result.success) {
                    // Remove from KV queue on success
                    await this.removeQueueItem(queuedReply.id);
                    if (queuedReply.resolve) queuedReply.resolve(result);
                } else {
                    // Handle retry logic
                    await this.handleRetry(queuedReply, result.error || 'Unknown error');
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                await this.handleRetry(queuedReply, errorMsg);
            }

            // Add a small delay between requests to be respectful
            await this.delay(2000); // 2 seconds between requests
        }
    }

    /**
     * Handle retry logic with exponential backoff
     */
    private async handleRetry(queuedReply: QueuedReply, error: string): Promise<void> {
        queuedReply.attempts++;
        queuedReply.lastAttempt = Date.now();

        if (queuedReply.attempts >= this.maxRetries) {
            // Remove from KV queue on max retries
            await this.removeQueueItem(queuedReply.id);
            if (queuedReply.resolve) queuedReply.resolve({ success: false, error: `Max retries exceeded: ${error}` });
            return;
        }

        // Update the item in KV with new attempt count
        await this.updateQueueItemAttempts(queuedReply.id, queuedReply.attempts, queuedReply.lastAttempt);

        // Exponential backoff: 1s, 4s, 10s
        const delay = this.baseDelay * Math.pow(4, queuedReply.attempts - 1);
        console.log(`[Twitter Reply] Retry ${queuedReply.attempts}/${this.maxRetries} for ${queuedReply.id} in ${delay}ms`);
        
        setTimeout(() => {
            this.replyQueue.unshift(queuedReply); // Add back to front of queue
        }, delay);
    }

    /**
     * Send a reply to a specific tweet (direct implementation)
     */
    private async sendReplyDirect(tweetId: string, message: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        try {
            // Ensure we're logged in
            await this.login();

            if (!this.client) {
                throw new Error('Twitter client not initialized');
            }

            console.log(`[Twitter Reply] Sending reply to tweet ${tweetId}: ${message.substring(0, 50)}...`);

            // Send the reply using twitter-api-v2
            const result = await this.client.v2.reply(message, tweetId);
            
            if (result && result.data && result.data.id) {
                console.log(`[Twitter Reply] ✅ Successfully sent reply: ${result.data.id}`);
                return { 
                    success: true, 
                    tweetId: result.data.id 
                };
            } else {
                throw new Error('Tweet send failed - no tweet ID returned');
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Twitter Reply] Failed to send reply to tweet ${tweetId}:`, errorMsg);
            return { 
                success: false, 
                error: errorMsg 
            };
        }
    }

    /**
     * Send a reply to a specific tweet (queued)
     */
    async replyToTweet(tweetId: string, message: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        // Ensure initialization
        await this.ensureInitialized();

        // Check if replies are enabled
        const repliesEnabled = process.env.TWITTER_REPLIES_ENABLED !== 'false';
        if (!repliesEnabled) {
            console.log('[Twitter Reply] Replies disabled via TWITTER_REPLIES_ENABLED env var');
            return { success: false, error: 'Twitter replies disabled' };
        }

        return new Promise(async (resolve, reject) => {
            const queuedReply: QueuedReply = {
                id: `${tweetId}_${Date.now()}`,
                tweetId,
                message,
                attempts: 0,
                resolve,
                reject
            };

            this.replyQueue.push(queuedReply);
            // Save to KV
            await this.saveQueueItem(queuedReply);
            console.log(`[Twitter Reply] Queued reply to tweet ${tweetId}. Queue size: ${this.replyQueue.length}. Rate limit: ${this.requestCount}/${this.maxRequestsPer24Hours}`);
        });
    }

    /**
     * Ensure the service is initialized
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            await this.initializeFromKV();
        }
    }

    /**
     * Utility function for delays
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Format the order execution notification message with randomized variations
     */
    formatExecutionMessage(execution: TwitterTriggerExecution, txid: string, tokenSymbol: string, amount: string): string {
        const explorerUrl = `https://explorer.hiro.so/txid/${txid}?chain=mainnet`;
        
        // 10 different message variations with the same direct, cool tone
        const messageVariations = [
            `hey @${execution.replierHandle} - i just sent you ${amount} ${tokenSymbol} to your bns at ${execution.bnsName} for replying to this post`,
            `@${execution.replierHandle} just sent you ${amount} ${tokenSymbol} to ${execution.bnsName} for the reply`,
            `hey @${execution.replierHandle} - you got ${amount} ${tokenSymbol} for replying. sent to ${execution.bnsName}`,
            `@${execution.replierHandle} sent ${amount} ${tokenSymbol} to your bns at ${execution.bnsName} for replying to this post`,
            `hey @${execution.replierHandle} - ${amount} ${tokenSymbol} sent to ${execution.bnsName} for the reply`,
            `@${execution.replierHandle} you got ${amount} ${tokenSymbol} at ${execution.bnsName} for replying to this`,
            `hey @${execution.replierHandle} - just sent ${amount} ${tokenSymbol} to ${execution.bnsName} for replying`,
            `@${execution.replierHandle} ${amount} ${tokenSymbol} sent to your bns at ${execution.bnsName} for the reply`,
            `hey @${execution.replierHandle} - sent you ${amount} ${tokenSymbol} at ${execution.bnsName} for replying to this post`,
            `@${execution.replierHandle} just dropped ${amount} ${tokenSymbol} to ${execution.bnsName} for the reply`
        ];
        
        // Use a deterministic random selection based on execution ID for consistency
        const messageIndex = parseInt(execution.id.slice(-2), 16) % messageVariations.length;
        const selectedMessage = messageVariations[messageIndex];
        
        return `${selectedMessage}\n\n${explorerUrl}`;
    }

    /**
     * Format the BNS not found message with randomized variations
     */
    formatBNSNotFoundMessage(replierHandle: string, bnsName?: string): string {
        // 5 different message variations encouraging BNS setup for Charisma airdrops
        const messageVariations = [
            `hey @${replierHandle} - couldn't find your bns${bnsName ? ` "${bnsName}"` : ''} in the registry. set up a .btc name to receive charisma airdrops! visit btc.us to get started`,
            `@${replierHandle} your bns${bnsName ? ` "${bnsName}"` : ''} isn't registered yet. grab a .btc name at btc.us to qualify for charisma token airdrops`,
            `hey @${replierHandle} - no bns${bnsName ? ` "${bnsName}"` : ''} found in the registry. get a .btc name at btc.us to receive future charisma airdrops`,
            `@${replierHandle} couldn't locate your bns${bnsName ? ` "${bnsName}"` : ''} in the registry. register a .btc name at btc.us for charisma airdrop eligibility`,
            `hey @${replierHandle} - bns${bnsName ? ` "${bnsName}"` : ''} not found. set up your .btc name at btc.us to get charisma airdrops when they drop`
        ];
        
        // Use a deterministic random selection based on handle for consistency
        const messageIndex = replierHandle.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % messageVariations.length;
        return messageVariations[messageIndex];
    }

    /**
     * Send order execution notification
     */
    async notifyOrderExecution(
        execution: TwitterTriggerExecution, 
        txid: string, 
        tokenSymbol: string, 
        amount: string
    ): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        try {
            const message = this.formatExecutionMessage(execution, txid, tokenSymbol, amount);
            
            console.log(`[Twitter Reply] Notifying order execution for ${execution.bnsName} (${execution.replierHandle})`);
            
            const result = await this.replyToTweet(execution.replyTweetId, message);
            
            if (result.success) {
                console.log(`[Twitter Reply] ✅ Successfully notified user ${execution.replierHandle} about order execution`);
            } else {
                console.error(`[Twitter Reply] ❌ Failed to notify user ${execution.replierHandle}:`, result.error);
            }
            
            return result;
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Twitter Reply] Error in notifyOrderExecution:`, errorMsg);
            return { 
                success: false, 
                error: errorMsg 
            };
        }
    }

    /**
     * Send BNS not found notification to encourage registration
     */
    async notifyBNSNotFound(
        replyTweetId: string,
        replierHandle: string, 
        bnsName?: string
    ): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        try {
            const message = this.formatBNSNotFoundMessage(replierHandle, bnsName);
            
            console.log(`[Twitter Reply] Notifying BNS not found for ${replierHandle}${bnsName ? ` (${bnsName})` : ''}`);
            
            const result = await this.replyToTweet(replyTweetId, message);
            
            if (result.success) {
                console.log(`[Twitter Reply] ✅ Successfully notified ${replierHandle} about BNS setup`);
            } else {
                console.error(`[Twitter Reply] ❌ Failed to notify ${replierHandle} about BNS setup:`, result.error);
            }
            
            return result;
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Twitter Reply] Error in notifyBNSNotFound:`, errorMsg);
            return { 
                success: false, 
                error: errorMsg 
            };
        }
    }

    /**
     * Get queue status for monitoring
     */
    async getQueueStatus(): Promise<{ queueSize: number; requestCount: number; maxRequests: number; rateLimitReset: number }> {
        await this.ensureInitialized();
        return {
            queueSize: this.replyQueue.length,
            requestCount: this.requestCount,
            maxRequests: this.maxRequestsPer24Hours,
            rateLimitReset: this.rateLimitReset
        };
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        try {
            this.isProcessingQueue = false;
            
            // Reject any pending queued replies
            while (this.replyQueue.length > 0) {
                const queuedReply = this.replyQueue.shift();
                if (queuedReply) {
                    queuedReply.resolve({ 
                        success: false, 
                        error: 'Service shutting down' 
                    });
                }
            }

            if (this.client && typeof this.client.destroy === 'function') {
                await this.client.destroy();
            }
            this.isLoggedIn = false;
            this.loginPromise = null;
            console.log('[Twitter Reply] Cleaned up Twitter client and queue');
        } catch (error) {
            console.error('[Twitter Reply] Error during cleanup:', error);
        }
    }
}

// Singleton instance
let twitterReplyService: TwitterReplyService | null = null;

/**
 * Get the singleton Twitter reply service instance
 */
export function getTwitterReplyService(): TwitterReplyService {
    if (!twitterReplyService) {
        twitterReplyService = new TwitterReplyService();
    }
    return twitterReplyService;
}