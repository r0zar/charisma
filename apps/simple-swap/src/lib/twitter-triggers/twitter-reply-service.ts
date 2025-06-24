import { TwitterTriggerExecution } from './types';
// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';

interface QueuedReply {
    id: string;
    tweetId: string;
    message: string;
    attempts: number;
    lastAttempt?: number;
    preferredMethod?: 'api' | 'auto';
    priority?: 'high' | 'normal' | 'low';
    createdAt: number;
    resolve: (result: { success: boolean; tweetId?: string; error?: string }) => void;
    reject: (error: Error) => void;
}

interface PersistedQueuedReply {
    id: string;
    tweetId: string;
    message: string;
    attempts: number;
    lastAttempt?: number;
    preferredMethod?: 'api' | 'auto';
    priority?: 'high' | 'normal' | 'low';
    createdAt: number;
}

interface QueueMetrics {
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    apiSuccessCount: number;
    averageProcessingTime: number;
    lastProcessedAt?: number;
}

interface QueueStatus {
    isProcessing: boolean;
    isPaused: boolean;
    queueSize: number;
    highPriorityCount: number;
    normalPriorityCount: number;
    lowPriorityCount: number;
    requestCount: number;
    maxRequests: number;
    rateLimitReset: number;
    metrics: QueueMetrics;
}

/**
 * Simplified Twitter reply service using only the Twitter API
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

    // Queue management controls
    private isPaused = false;
    private forceMethod: 'api' | 'auto' = 'auto';
    private metrics: QueueMetrics = {
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
        apiSuccessCount: 0,
        averageProcessingTime: 0,
        lastProcessedAt: undefined
    };
    private readonly metricsKey = 'twitter:reply:metrics';

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

            // Load metrics from KV
            const metricsData = await kv.get(this.metricsKey) as QueueMetrics | null;
            if (metricsData) {
                this.metrics = metricsData;
                console.log(`[Twitter Reply] Loaded metrics: ${this.metrics.successCount}/${this.metrics.totalProcessed} success rate`);
            }

            // Load queue from KV
            const persistedQueue = await kv.lrange(this.queueKey, 0, -1) as PersistedQueuedReply[];
            console.log(`[Twitter Reply] Loading ${persistedQueue.length} items from persisted queue`);
            
            // Convert persisted queue items to in-memory queue items (sorted by priority)
            const sortedQueue = persistedQueue.sort((a, b) => {
                const priorityOrder = { high: 3, normal: 2, low: 1 };
                const aPriority = priorityOrder[a.priority || 'normal'];
                const bPriority = priorityOrder[b.priority || 'normal'];
                return bPriority - aPriority; // High priority first
            });

            for (const persistedItem of sortedQueue) {
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
     * Save metrics to KV
     */
    private async saveMetrics(): Promise<void> {
        try {
            await kv.set(this.metricsKey, this.metrics);
        } catch (error) {
            console.error('[Twitter Reply] Failed to save metrics:', error);
        }
    }

    /**
     * Update metrics with processing result
     */
    private async updateMetrics(success: boolean, processingTime: number): Promise<void> {
        const totalTime = this.metrics.averageProcessingTime * this.metrics.totalProcessed + processingTime;
        
        this.metrics.totalProcessed++;
        this.metrics.averageProcessingTime = totalTime / this.metrics.totalProcessed;
        this.metrics.lastProcessedAt = Date.now();
        
        if (success) {
            this.metrics.successCount++;
            this.metrics.apiSuccessCount++;
        } else {
            this.metrics.failureCount++;
        }
        
        await this.saveMetrics();
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
     * Login to Twitter API
     */
    private async login(): Promise<void> {
        // Return existing login promise if already in progress
        if (this.loginPromise) {
            return this.loginPromise;
        }

        if (this.isLoggedIn && this.client) {
            return;
        }

        this.loginPromise = this._performLogin();
        return this.loginPromise;
    }

    private async _performLogin(): Promise<void> {
        try {
            const { TwitterApi } = await import('twitter-api-v2');
            
            // Get credentials from environment
            const apiKey = process.env.TWITTER_API_KEY;
            const apiSecret = process.env.TWITTER_API_SECRET;
            const accessToken = process.env.TWITTER_ACCESS_TOKEN;
            const accessSecret = process.env.TWITTER_ACCESS_SECRET;

            if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
                throw new Error('Missing Twitter API credentials. Please set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_SECRET environment variables.');
            }

            this.client = new TwitterApi({
                appKey: apiKey,
                appSecret: apiSecret,
                accessToken: accessToken,
                accessSecret: accessSecret,
            });

            // Verify credentials
            await this.client.v2.me();
            
            this.isLoggedIn = true;
            this.loginPromise = null;
            
            console.log('[Twitter Reply] Successfully logged into Twitter API');
        } catch (error) {
            this.isLoggedIn = false;
            this.loginPromise = null;
            throw error;
        }
    }

    /**
     * Start the queue processor
     */
    private startQueueProcessor(): void {
        if (this.isProcessingQueue) {
            return;
        }

        this.isProcessingQueue = true;
        console.log('[Twitter Reply] Starting queue processor');
        
        // Process queue every 5 seconds
        const processInterval = setInterval(async () => {
            try {
                await this.processQueue();
            } catch (error) {
                console.error('[Twitter Reply] Error in queue processor:', error);
            }
        }, 5000);

        // Reset rate limit counter every 24 hours
        const resetInterval = setInterval(async () => {
            const now = Date.now();
            if (now >= this.rateLimitReset) {
                this.requestCount = 0;
                this.rateLimitReset = now + 24 * 60 * 60 * 1000;
                await this.saveRateLimitState();
                console.log('[Twitter Reply] Rate limit counter reset');
            }
        }, 60000); // Check every minute

        // Clean up on process exit
        process.on('SIGTERM', () => {
            clearInterval(processInterval);
            clearInterval(resetInterval);
        });
        process.on('SIGINT', () => {
            clearInterval(processInterval);
            clearInterval(resetInterval);
        });
    }

    /**
     * Process the reply queue
     */
    private async processQueue(): Promise<void> {
        if (this.isPaused || this.replyQueue.length === 0) {
            return;
        }

        // Check rate limit
        if (this.requestCount >= this.maxRequestsPer24Hours) {
            console.log(`[Twitter Reply] Rate limit reached (${this.requestCount}/${this.maxRequestsPer24Hours}). Queue processing paused until reset.`);
            return;
        }

        const queuedReply = this.replyQueue.shift();
        if (!queuedReply) {
            return;
        }

        console.log(`[Twitter Reply] Processing queued reply ${queuedReply.id} (priority: ${queuedReply.priority || 'normal'}). Queue size: ${this.replyQueue.length}. Rate limit: ${this.requestCount}/${this.maxRequestsPer24Hours}`);

        const startTime = Date.now();

        try {
            const result = await this.sendReplyDirect(queuedReply.tweetId, queuedReply.message);
            
            if (result.success) {
                this.requestCount++;
                await this.saveRateLimitState();
            }

            const processingTime = Date.now() - startTime;
            await this.updateMetrics(result.success, processingTime);

            if (result.success) {
                console.log(`[Twitter Reply] ✅ Successfully sent reply to tweet ${queuedReply.tweetId}: ${result.tweetId || 'unknown'}`);
                
                // Remove from KV queue on success
                await kv.lrem(this.queueKey, 1, {
                    id: queuedReply.id,
                    tweetId: queuedReply.tweetId,
                    message: queuedReply.message,
                    attempts: queuedReply.attempts,
                    lastAttempt: queuedReply.lastAttempt,
                    preferredMethod: queuedReply.preferredMethod,
                    priority: queuedReply.priority,
                    createdAt: queuedReply.createdAt
                });
                
                queuedReply.resolve(result);
            } else {
                await this.handleRetry(queuedReply, result.error || 'Unknown error');
            }

        } catch (error) {
            const processingTime = Date.now() - startTime;
            await this.updateMetrics(false, processingTime);
            
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Twitter Reply] Failed to send reply to tweet ${queuedReply.tweetId}:`, errorMsg);
            
            await this.handleRetry(queuedReply, errorMsg);
        }
    }

    /**
     * Handle retry logic for failed replies
     */
    private async handleRetry(queuedReply: QueuedReply, error: string): Promise<void> {
        queuedReply.attempts++;
        queuedReply.lastAttempt = Date.now();

        if (queuedReply.attempts >= this.maxRetries) {
            console.log(`[Twitter Reply] ❌ Max retries reached for reply ${queuedReply.id}. Giving up.`);
            
            // Remove from KV queue
            await kv.lrem(this.queueKey, 1, {
                id: queuedReply.id,
                tweetId: queuedReply.tweetId,
                message: queuedReply.message,
                attempts: queuedReply.attempts - 1, // Use previous attempt count for KV removal
                lastAttempt: queuedReply.lastAttempt,
                preferredMethod: queuedReply.preferredMethod,
                priority: queuedReply.priority,
                createdAt: queuedReply.createdAt
            });
            
            queuedReply.reject(new Error(`Failed after ${this.maxRetries} attempts: ${error}`));
        } else {
            const delay = this.baseDelay * Math.pow(2, queuedReply.attempts - 1); // Exponential backoff
            console.log(`[Twitter Reply] Retry ${queuedReply.attempts}/${this.maxRetries} for ${queuedReply.id} in ${delay}ms`);
            
            // Update in KV with new attempt count
            const persistedItem: PersistedQueuedReply = {
                id: queuedReply.id,
                tweetId: queuedReply.tweetId,
                message: queuedReply.message,
                attempts: queuedReply.attempts,
                lastAttempt: queuedReply.lastAttempt,
                preferredMethod: queuedReply.preferredMethod,
                priority: queuedReply.priority,
                createdAt: queuedReply.createdAt
            };
            
            await kv.lrem(this.queueKey, 1, {
                ...persistedItem,
                attempts: queuedReply.attempts - 1
            });
            await kv.lpush(this.queueKey, persistedItem);
            
            // Re-add to in-memory queue with delay
            setTimeout(() => {
                this.replyQueue.unshift(queuedReply);
            }, delay);
        }
    }

    /**
     * Send reply directly using Twitter API
     */
    private async sendReplyDirect(tweetId: string, message: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        try {
            // Ensure we're logged in
            await this.login();

            if (!this.client) {
                throw new Error('Twitter client not initialized');
            }

            console.log(`[Twitter Reply] Sending reply via API to tweet ${tweetId}: ${message.substring(0, 50)}...`);

            // Send the reply using twitter-api-v2
            const result = await this.client.v2.reply(message, tweetId);

            if (result?.data?.id) {
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
            console.error(`[Twitter Reply] Failed to send reply via API to tweet ${tweetId}:`, errorMsg);
            
            // No fallback options - API only
            const isRateLimit = errorMsg.includes('rate') || errorMsg.includes('429') || errorMsg.includes('Too Many Requests');
            
            if (isRateLimit) {
                console.log(`[Twitter Reply] 🔄 API rate limited, no fallback available. Retry later.`);
            }
            
            return { 
                success: false, 
                error: errorMsg 
            };
        }
    }

    /**
     * Add a reply to the queue
     */
    async replyToTweet(
        tweetId: string, 
        message: string, 
        options?: {
            priority?: 'high' | 'normal' | 'low';
            preferredMethod?: 'api' | 'auto';
        }
    ): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        // Ensure initialization
        await this.ensureInitialized();

        // Check if replies are enabled
        const repliesEnabled = process.env.TWITTER_REPLIES_ENABLED !== 'false';
        if (!repliesEnabled) {
            console.log('[Twitter Reply] Replies disabled via TWITTER_REPLIES_ENABLED env var');
            return { success: false, error: 'Twitter replies disabled' };
        }

        const replyId = `${tweetId}_${Date.now()}`;
        const priority = options?.priority || 'normal';
        const preferredMethod = options?.preferredMethod || 'auto';

        return new Promise((resolve, reject) => {
            const queuedReply: QueuedReply = {
                id: replyId,
                tweetId,
                message,
                attempts: 0,
                preferredMethod,
                priority,
                createdAt: Date.now(),
                resolve,
                reject
            };

            // Add to in-memory queue (sorted by priority)
            const priorityOrder = { high: 3, normal: 2, low: 1 };
            const insertIndex = this.replyQueue.findIndex(item => {
                const itemPriority = priorityOrder[item.priority || 'normal'];
                const newItemPriority = priorityOrder[priority];
                return newItemPriority > itemPriority;
            });

            if (insertIndex === -1) {
                this.replyQueue.push(queuedReply);
            } else {
                this.replyQueue.splice(insertIndex, 0, queuedReply);
            }

            // Persist to KV
            const persistedItem: PersistedQueuedReply = {
                id: replyId,
                tweetId,
                message,
                attempts: 0,
                preferredMethod,
                priority,
                createdAt: Date.now()
            };

            kv.lpush(this.queueKey, persistedItem).catch(error => {
                console.error('[Twitter Reply] Failed to persist queue item to KV:', error);
            });

            console.log(`[Twitter Reply] Added reply to queue: ${replyId} (priority: ${priority}, method: ${preferredMethod})`);
        });
    }

    /**
     * Get queue status
     */
    async getQueueStatus(): Promise<QueueStatus> {
        await this.ensureInitialized();
        
        const highPriorityCount = this.replyQueue.filter(item => item.priority === 'high').length;
        const normalPriorityCount = this.replyQueue.filter(item => item.priority === 'normal').length;
        const lowPriorityCount = this.replyQueue.filter(item => item.priority === 'low').length;

        return {
            isProcessing: this.isProcessingQueue,
            isPaused: this.isPaused,
            queueSize: this.replyQueue.length,
            highPriorityCount,
            normalPriorityCount,
            lowPriorityCount,
            requestCount: this.requestCount,
            maxRequests: this.maxRequestsPer24Hours,
            rateLimitReset: this.rateLimitReset,
            metrics: this.metrics
        };
    }

    /**
     * Get queue items
     */
    async getQueueItems(limit: number = 50): Promise<PersistedQueuedReply[]> {
        await this.ensureInitialized();
        
        return this.replyQueue.slice(0, limit).map(item => ({
            id: item.id,
            tweetId: item.tweetId,
            message: item.message,
            attempts: item.attempts,
            lastAttempt: item.lastAttempt,
            preferredMethod: item.preferredMethod,
            priority: item.priority,
            createdAt: item.createdAt
        }));
    }

    /**
     * Pause queue processing
     */
    async pauseQueue(): Promise<void> {
        this.isPaused = true;
        console.log('[Twitter Reply] Queue processing paused');
    }

    /**
     * Resume queue processing
     */
    async resumeQueue(): Promise<void> {
        this.isPaused = false;
        console.log('[Twitter Reply] Queue processing resumed');
    }

    /**
     * Clear all items from queue
     */
    async clearQueue(): Promise<{ cleared: number }> {
        const clearedCount = this.replyQueue.length;
        this.replyQueue = [];
        
        // Clear KV queue
        await kv.del(this.queueKey);
        
        console.log(`[Twitter Reply] Cleared ${clearedCount} items from queue`);
        return { cleared: clearedCount };
    }

    /**
     * Retry failed items
     */
    async retryFailedItems(): Promise<{ retried: number }> {
        const retriedCount = this.replyQueue.filter(item => item.attempts > 0).length;
        
        // Reset attempts for all items
        for (const item of this.replyQueue) {
            if (item.attempts > 0) {
                item.attempts = 0;
                item.lastAttempt = undefined;
            }
        }
        
        console.log(`[Twitter Reply] Reset retry attempts for ${retriedCount} items`);
        return { retried: retriedCount };
    }

    /**
     * Set the preferred method for new queue items
     */
    async setForceMethod(method: 'api' | 'auto'): Promise<void> {
        this.forceMethod = method;
        console.log(`[Twitter Reply] Force method set to: ${method}`);
    }

    /**
     * Get the current force method
     */
    getForceMethod(): 'api' | 'auto' {
        return this.forceMethod;
    }

    /**
     * Reset metrics
     */
    async resetMetrics(): Promise<void> {
        this.metrics = {
            totalProcessed: 0,
            successCount: 0,
            failureCount: 0,
            apiSuccessCount: 0,
            averageProcessingTime: 0,
            lastProcessedAt: undefined
        };
        
        await this.saveMetrics();
        console.log('[Twitter Reply] Metrics reset');
    }

    /**
     * Send notification when BNS is not found
     */
    async notifyBNSNotFound(
        replyTweetId: string, 
        userHandle: string, 
        bnsName?: string
    ): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        const message = bnsName 
            ? `Hi @${userHandle}! Your BNS "${bnsName}" couldn't be resolved. Please make sure it's properly set up at btc.us/names to receive Charisma airdrops! 🪂`
            : `Hi @${userHandle}! We couldn't find a BNS name associated with your account. Set one up at btc.us/names to receive Charisma airdrops! 🪂`;
        
        console.log(`[Twitter Reply] Sending BNS notification to @${userHandle}${bnsName ? ` for ${bnsName}` : ''}`);
        
        return this.replyToTweet(replyTweetId, message, {
            priority: 'normal',
            preferredMethod: 'api'
        });
    }

    /**
     * Send notification when order is executed
     */
    async notifyOrderExecution(
        execution: TwitterTriggerExecution,
        txid: string,
        tokenSymbol: string,
        amount: string
    ): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        const message = `🎉 @${execution.replierHandle} Your ${amount} ${tokenSymbol} tokens have been sent to ${execution.bnsName}! Transaction: https://explorer.hiro.so/txid/${txid}`;
        
        console.log(`[Twitter Reply] Sending order execution notification to @${execution.replierHandle} for ${amount} ${tokenSymbol}`);
        
        return this.replyToTweet(execution.replyTweetId, message, {
            priority: 'high',
            preferredMethod: 'api'
        });
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        try {
            this.isLoggedIn = false;
            this.loginPromise = null;
            
            console.log('[Twitter Reply] Cleaned up Twitter client and queue');
        } catch (error) {
            console.error('[Twitter Reply] Error during cleanup:', error);
        }
    }
}

// Singleton instance
let instance: TwitterReplyService | null = null;

export function getTwitterReplyService(): TwitterReplyService {
    if (!instance) {
        instance = new TwitterReplyService();
    }
    return instance;
}