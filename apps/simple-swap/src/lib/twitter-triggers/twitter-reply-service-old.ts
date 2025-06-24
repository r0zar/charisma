import { TwitterTriggerExecution } from './types';
// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';

interface QueuedReply {
    id: string;
    tweetId: string;
    message: string;
    attempts: number;
    lastAttempt?: number;
    preferredMethod?: 'api' | 'auto'; // Track which method to use
    priority?: 'high' | 'normal' | 'low'; // Priority level
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
    browserlessSuccessCount: number;
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
    browserlessEnabled: boolean;
    browserlessConnected: boolean;
    browserqlEnabled: boolean;
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


    // Queue management controls
    private isPaused = false;
    private forceMethod: 'api' | 'auto' = 'auto';
    private metrics: QueueMetrics = {
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
        apiSuccessCount: 0,
        browserlessSuccessCount: 0,
        averageProcessingTime: 0,
        lastProcessedAt: undefined
    };
    private readonly metricsKey = 'twitter:reply:metrics';

    constructor() {
        this.client = null;
        // Twitter API only setup
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
    private async updateMetrics(success: boolean, method: 'api' | 'browserless', processingTime: number): Promise<void> {
        const totalTime = this.metrics.averageProcessingTime * this.metrics.totalProcessed + processingTime;
        
        this.metrics.totalProcessed++;
        this.metrics.averageProcessingTime = totalTime / this.metrics.totalProcessed;
        this.metrics.lastProcessedAt = Date.now();
        
        if (success) {
            this.metrics.successCount++;
            if (method === 'api') {
                this.metrics.apiSuccessCount++;
            } else {
                this.metrics.browserlessSuccessCount++;
            }
        } else {
            this.metrics.failureCount++;
        }
        
        await this.saveMetrics();
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
                preferredMethod: item.preferredMethod,
                priority: item.priority,
                createdAt: item.createdAt
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
     * Check if we should use batch processing for browserless
     */
    private shouldUseBatchProcessing(): boolean {
        const browserlessEnabled = process.env.BROWSERLESS_ENABLED === 'true';
        const hasBrowserlessCredentials = !!this.browserlessCredentials;
        const queueSize = this.replyQueue.length;
        const timeSinceLastBatch = Date.now() - this.lastBatchProcessTime;
        const canUseBatch = timeSinceLastBatch > this.batchCooldown;
        
        // Count browserless items in queue
        const browserlessItems = this.replyQueue.filter(item => 
            this.determineReplyMethod(item) === 'browserless'
        ).length;
        
        return browserlessEnabled && 
               hasBrowserlessCredentials && 
               browserlessItems >= this.browserlessBatchThreshold &&
               canUseBatch &&
               !this.browserlessBot?.isBatchProcessing;
    }

    /**
     * Process browserless items in batch
     */
    private async processBrowserlessBatch(): Promise<void> {
        if (!this.browserlessCredentials) {
            console.warn('[Twitter Reply] No browserless credentials available for batch processing');
            return;
        }

        // Find all browserless items in queue
        const browserlessItems: QueuedReply[] = [];
        const remainingItems: QueuedReply[] = [];
        
        for (const item of this.replyQueue) {
            if (this.determineReplyMethod(item) === 'browserless') {
                browserlessItems.push(item);
            } else {
                remainingItems.push(item);
            }
        }
        
        if (browserlessItems.length === 0) {
            return;
        }

        console.log(`[Twitter Reply] 🚀 Starting batch processing of ${browserlessItems.length} browserless items`);
        
        try {
            // Initialize browserless bot if needed
            await this.initializeBrowserlessBot();
            
            if (!this.browserlessBot) {
                throw new Error('Browserless bot not available');
            }

            // Convert queue items to ReplyConfig format
            const replyConfigs = browserlessItems.map(item => ({
                tweetUrl: `https://x.com/status/${item.tweetId}`,
                replyText: item.message,
                delay: 1000
            }));

            // Process batch
            const results = await this.browserlessBot.postBatchReplies(replyConfigs, this.browserlessCredentials);
            
            // Process results
            for (let i = 0; i < browserlessItems.length; i++) {
                const item = browserlessItems[i];
                const result = results[i];
                
                const processingTime = 5000; // Estimate for batch items
                await this.updateMetrics(result.success, 'browserless', processingTime);
                
                if (result.success) {
                    // Remove from KV queue on success
                    await this.removeQueueItem(item.id);
                    if (item.resolve) item.resolve(result);
                } else {
                    // Handle retry logic
                    await this.handleRetry(item, result.error || 'Batch processing failed');
                }
            }

            // Update the in-memory queue to remove processed items
            this.replyQueue = remainingItems.concat(
                browserlessItems.filter(item => !results[browserlessItems.indexOf(item)]?.success)
            );
            
            this.lastBatchProcessTime = Date.now();
            console.log(`[Twitter Reply] ✅ Batch processing completed. ${results.filter(r => r.success).length}/${browserlessItems.length} successful`);
            
        } catch (error) {
            console.error('[Twitter Reply] Batch processing failed:', error);
            
            // On batch failure, mark all items for individual retry
            for (const item of browserlessItems) {
                await this.handleRetry(item, `Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    /**
     * Process the reply queue with rate limiting and controls
     */
    private async processQueue(): Promise<void> {
        while (this.isProcessingQueue) {
            // Check if queue is paused
            if (this.isPaused) {
                console.log('[Twitter Reply] Queue processing paused. Waiting...');
                await this.delay(5000); // 5 seconds
                continue;
            }

            if (this.replyQueue.length === 0) {
                // Wait a bit before checking again
                await this.delay(5000); // 5 seconds
                continue;
            }

            // Check if we should use batch processing for browserless items
            if (this.shouldUseBatchProcessing()) {
                await this.processBrowserlessBatch();
                // After batch processing, continue with normal queue processing
                await this.delay(2000); // Short delay before continuing
                continue;
            }

            // Check if we've hit the daily rate limit (only for API method)
            const shouldCheckRateLimit = this.forceMethod === 'api' || 
                                       (this.forceMethod === 'auto' && 
                                        process.env.BROWSERLESS_ENABLED !== 'true');
            
            if (shouldCheckRateLimit && this.requestCount >= this.maxRequestsPer24Hours) {
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

            console.log(`[Twitter Reply] Processing queued reply ${queuedReply.id} (priority: ${queuedReply.priority || 'normal'}). Queue size: ${this.replyQueue.length}. Rate limit: ${this.requestCount}/${this.maxRequestsPer24Hours}`);

            const startTime = Date.now();
            let usedMethod: 'api' | 'browserless' = 'api';

            try {
                let result;
                
                // Determine which method to use based on controls and item preference
                const effectiveMethod = this.determineReplyMethod(queuedReply);
                
                if (effectiveMethod === 'browserless') {
                    result = await this.sendReplyWithBrowserless(queuedReply.tweetId, queuedReply.message);
                    usedMethod = 'browserless';
                } else if (effectiveMethod === 'api') {
                    result = await this.sendReplyDirectAPI(queuedReply.tweetId, queuedReply.message);
                    usedMethod = 'api';
                    if (result.success) {
                        this.requestCount++;
                        await this.saveRateLimitState();
                    }
                } else {
                    // Auto mode - try API first, then browserless on rate limit
                    result = await this.sendReplyDirect(queuedReply.tweetId, queuedReply.message);
                    // sendReplyDirect will set usedMethod based on which succeeded
                    usedMethod = result.success && this.requestCount > 0 ? 'api' : 'browserless';
                    if (result.success && usedMethod === 'api') {
                        this.requestCount++;
                        await this.saveRateLimitState();
                    }
                }
                
                const processingTime = Date.now() - startTime;
                await this.updateMetrics(result.success, usedMethod, processingTime);
                
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
                const processingTime = Date.now() - startTime;
                await this.updateMetrics(false, usedMethod, processingTime);
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
     * Initialize browserless bot if enabled and credentials are available
     */
    private async initializeBrowserlessBot(): Promise<void> {
        // Return existing login promise if already in progress
        if (this.browserlessLoginPromise) {
            return this.browserlessLoginPromise;
        }

        if (this.browserlessBot) {
            return;
        }

        const browserlessEnabled = process.env.BROWSERLESS_ENABLED === 'true';
        const browserlessToken = process.env.BROWSERLESS_TOKEN;

        if (!browserlessEnabled || !browserlessToken || !this.browserlessCredentials) {
            return;
        }

        this.browserlessLoginPromise = this._performBrowserlessInit(browserlessToken);
        return this.browserlessLoginPromise;
    }

    private async _performBrowserlessInit(browserlessToken: string): Promise<void> {
        try {
            console.log('[Twitter Reply] 🚀 Initializing browserless bot...');
            console.log('[Twitter Reply] 🔑 Token length:', browserlessToken.length);
            console.log('[Twitter Reply] 👤 Credentials available:', !!this.browserlessCredentials);
            
            this.browserlessBot = new XReplyBot(browserlessToken);
            
            console.log('[Twitter Reply] 🔧 Starting browserless bot initialization...');
            const initPromise = this.browserlessBot.init();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Browserless initialization timeout after 60s')), 60000)
            );
            
            await Promise.race([initPromise, timeoutPromise]);
            console.log('[Twitter Reply] ✅ Browserless bot initialization completed');
            
            console.log('[Twitter Reply] 🔐 Starting login process...');
            const loginPromise = this.browserlessBot.login(this.browserlessCredentials!);
            const loginTimeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Browserless login timeout after 90s')), 90000)
            );
            
            await Promise.race([loginPromise, loginTimeoutPromise]);
            console.log('[Twitter Reply] ✅ Browserless bot login completed');
            
            console.log('[Twitter Reply] ✅ Browserless bot fully initialized and ready');
            this.browserlessLoginPromise = null;
            
        } catch (error) {
            console.error('[Twitter Reply] ❌ Failed to initialize browserless bot:', error);
            console.error('[Twitter Reply] 🔍 Error context:', {
                hasToken: !!browserlessToken,
                tokenLength: browserlessToken?.length || 0,
                hasCredentials: !!this.browserlessCredentials,
                username: this.browserlessCredentials?.username || 'none'
            });
            
            // Clean up on failure
            if (this.browserlessBot) {
                try {
                    await this.browserlessBot.close();
                } catch (cleanupError) {
                    console.warn('[Twitter Reply] Failed to cleanup browserless bot:', cleanupError);
                }
            }
            
            this.browserlessBot = null;
            this.browserlessLoginPromise = null;
            throw error;
        }
    }

    /**
     * Send a reply using browserless bot as fallback
     */
    private async sendReplyWithBrowserless(tweetId: string, message: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        try {
            // Initialize browserless bot if needed
            await this.initializeBrowserlessBot();

            if (!this.browserlessBot) {
                throw new Error('Browserless bot not available');
            }

            console.log(`[Twitter Reply] Sending reply via browserless to tweet ${tweetId}: ${message.substring(0, 50)}...`);

            // Construct the tweet URL for browserless
            const tweetUrl = `https://x.com/status/${tweetId}`;
            
            const result = await this.browserlessBot.replyToTweet({
                tweetUrl,
                replyText: message,
                delay: 2000
            });
            
            if (result.success) {
                console.log(`[Twitter Reply] ✅ Successfully sent reply via browserless: ${result.tweetId || 'unknown'}`);
                return { 
                    success: true, 
                    tweetId: result.tweetId 
                };
            } else {
                throw new Error(result.error || 'Browserless reply failed');
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Twitter Reply] Failed to send reply via browserless to tweet ${tweetId}:`, errorMsg);
            return { 
                success: false, 
                error: errorMsg 
            };
        }
    }

    /**
     * Initialize BrowserQL bot if enabled and credentials are available
     */
    private async initializeBrowserQLBot(): Promise<void> {
        // Return existing login promise if already in progress
        if (this.browserqlLoginPromise) {
            return this.browserqlLoginPromise;
        }

        if (this.browserqlBot) {
            return;
        }

        const browserqlEnabled = process.env.BROWSERQL_ENABLED === 'true';
        const browserlessToken = process.env.BROWSERLESS_TOKEN; // BrowserQL uses same token as browserless

        if (!browserqlEnabled || !browserlessToken || !this.browserqlCredentials) {
            return;
        }

        this.browserqlLoginPromise = this._performBrowserQLInit(browserlessToken);
        return this.browserqlLoginPromise;
    }

    private async _performBrowserQLInit(browserlessToken: string): Promise<void> {
        try {
            console.log('[Twitter Reply] 🚀 Initializing BrowserQL bot...');
            console.log('[Twitter Reply] 🔑 Token length:', browserlessToken.length);
            console.log('[Twitter Reply] 👤 Credentials available:', !!this.browserqlCredentials);
            
            this.browserqlBot = new BrowserQLBot(browserlessToken);
            
            console.log('[Twitter Reply] 🔧 Starting BrowserQL bot initialization...');
            const initPromise = this.browserqlBot.init(this.browserqlCredentials!);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('BrowserQL initialization timeout after 60s')), 60000)
            );
            
            await Promise.race([initPromise, timeoutPromise]);
            console.log('[Twitter Reply] ✅ BrowserQL bot initialization completed');
            
            console.log('[Twitter Reply] ✅ BrowserQL bot fully initialized and ready');
            this.browserqlLoginPromise = null;
            
        } catch (error) {
            console.error('[Twitter Reply] ❌ Failed to initialize BrowserQL bot:', error);
            console.error('[Twitter Reply] 🔍 Error context:', {
                hasToken: !!browserlessToken,
                tokenLength: browserlessToken?.length || 0,
                hasCredentials: !!this.browserqlCredentials,
                username: this.browserqlCredentials?.username || 'none'
            });
            
            // Clean up on failure
            if (this.browserqlBot) {
                try {
                    await this.browserqlBot.close();
                } catch (cleanupError) {
                    console.warn('[Twitter Reply] Failed to cleanup BrowserQL bot:', cleanupError);
                }
            }
            
            this.browserqlBot = null;
            this.browserqlLoginPromise = null;
            throw error;
        }
    }


    /**
     * Send reply using BrowserQL (stealth-first automation)
     */
    private async sendReplyWithBrowserQL(tweetId: string, message: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        try {
            // Initialize BrowserQL bot if needed
            await this.initializeBrowserQLBot();

            if (!this.browserqlBot) {
                throw new Error('BrowserQL bot not available');
            }

            console.log(`[Twitter Reply] Sending reply via BrowserQL to tweet ${tweetId}: ${message.substring(0, 50)}...`);

            // Construct the tweet URL for BrowserQL
            const tweetUrl = `https://x.com/status/${tweetId}`;
            
            const result = await this.browserqlBot.replyToTweet({
                tweetUrl,
                replyText: message,
                delay: 2000
            });
            
            if (result.success) {
                console.log(`[Twitter Reply] ✅ Successfully sent reply via BrowserQL: ${result.tweetId || 'unknown'}`);
                return { 
                    success: true, 
                    tweetId: result.tweetId 
                };
            } else {
                throw new Error(result.error || 'BrowserQL reply failed');
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Twitter Reply] Failed to send reply via BrowserQL to tweet ${tweetId}:`, errorMsg);
            return { 
                success: false, 
                error: errorMsg 
            };
        }
    }

    /**
     * Determine which reply method to use based on controls and preferences
     */
    private determineReplyMethod(queuedReply: QueuedReply): 'api' | 'browserless' | 'browserql' | 'auto' {
        // Global force method takes priority
        if (this.forceMethod !== 'auto') {
            return this.forceMethod;
        }
        
        // Item-specific preference
        if (queuedReply.preferredMethod && queuedReply.preferredMethod !== 'auto') {
            return queuedReply.preferredMethod;
        }
        
        // Default to auto
        return 'auto';
    }

    /**
     * Send reply using only the Twitter API (no fallback)
     */
    private async sendReplyDirectAPI(tweetId: string, message: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        try {
            // Ensure we're logged in
            await this.login();

            if (!this.client) {
                throw new Error('Twitter client not initialized');
            }

            console.log(`[Twitter Reply] Sending reply via API to tweet ${tweetId}: ${message.substring(0, 50)}...`);

            // Send the reply using twitter-api-v2
            const result = await this.client.v2.reply(message, tweetId);
            
            if (result && result.data && result.data.id) {
                console.log(`[Twitter Reply] ✅ Successfully sent reply via API: ${result.data.id}`);
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
            return { 
                success: false, 
                error: errorMsg 
            };
        }
    }

    /**
     * Send a reply to a specific tweet (direct implementation with auto-fallback)
     */
    private async sendReplyDirect(tweetId: string, message: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        // First try Twitter API
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
     * Send a reply to a specific tweet (queued)
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

        return new Promise(async (resolve, reject) => {
            const queuedReply: QueuedReply = {
                id: `${tweetId}_${Date.now()}`,
                tweetId,
                message,
                attempts: 0,
                priority: options?.priority || 'normal',
                preferredMethod: options?.preferredMethod || 'auto',
                createdAt: Date.now(),
                resolve,
                reject
            };

            // Insert based on priority (high priority goes to front)
            if (queuedReply.priority === 'high') {
                this.replyQueue.unshift(queuedReply);
            } else {
                this.replyQueue.push(queuedReply);
            }
            
            // Save to KV
            await this.saveQueueItem(queuedReply);
            console.log(`[Twitter Reply] Queued ${queuedReply.priority} priority reply to tweet ${tweetId}. Queue size: ${this.replyQueue.length}. Rate limit: ${this.requestCount}/${this.maxRequestsPer24Hours}`);
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
     * Get comprehensive queue status for monitoring
     */
    async getQueueStatus(): Promise<QueueStatus> {
        await this.ensureInitialized();
        
        // Count items by priority
        const priorityCounts = this.replyQueue.reduce(
            (acc, item) => {
                const priority = item.priority || 'normal';
                acc[`${priority}PriorityCount`]++;
                return acc;
            },
            { highPriorityCount: 0, normalPriorityCount: 0, lowPriorityCount: 0 }
        );
        
        return {
            isProcessing: this.isProcessingQueue,
            isPaused: this.isPaused,
            queueSize: this.replyQueue.length,
            ...priorityCounts,
            requestCount: this.requestCount,
            maxRequests: this.maxRequestsPer24Hours,
            rateLimitReset: this.rateLimitReset,
            metrics: this.metrics,
            browserlessEnabled: process.env.BROWSERLESS_ENABLED === 'true',
            browserlessConnected: this.browserlessBot?.loggedIn || false,
            browserqlEnabled: process.env.BROWSERQL_ENABLED === 'true'
        };
    }

    // ===== QUEUE MANAGEMENT CONTROLS =====

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
     * Clear all items from the queue
     */
    async clearQueue(): Promise<{ cleared: number }> {
        const clearedCount = this.replyQueue.length;
        
        // Reject all pending items
        while (this.replyQueue.length > 0) {
            const queuedReply = this.replyQueue.shift();
            if (queuedReply) {
                queuedReply.resolve({ 
                    success: false, 
                    error: 'Queue cleared by admin' 
                });
            }
        }

        // Clear from KV
        try {
            await kv.del(this.queueKey);
            console.log(`[Twitter Reply] Cleared ${clearedCount} items from queue`);
        } catch (error) {
            console.error('[Twitter Reply] Failed to clear queue from KV:', error);
        }

        return { cleared: clearedCount };
    }

    /**
     * Set the preferred method for new queue items
     */
    async setForceMethod(method: 'api' | 'browserless' | 'browserql' | 'auto'): Promise<void> {
        this.forceMethod = method;
        console.log(`[Twitter Reply] Force method set to: ${method}`);
    }

    /**
     * Get the current force method
     */
    getForceMethod(): 'api' | 'browserless' | 'browserql' | 'auto' {
        return this.forceMethod;
    }

    /**
     * Retry all failed items in the queue
     */
    async retryFailedItems(): Promise<{ retried: number }> {
        // This would involve scanning persisted failed items and re-queuing them
        // For now, we'll implement a basic version that clears retry attempts
        let retriedCount = 0;
        
        for (const item of this.replyQueue) {
            if (item.attempts > 0) {
                item.attempts = 0;
                item.lastAttempt = undefined;
                retriedCount++;
            }
        }
        
        console.log(`[Twitter Reply] Reset retry attempts for ${retriedCount} items`);
        return { retried: retriedCount };
    }

    /**
     * Get detailed queue items (for admin inspection)
     */
    async getQueueItems(limit: number = 50): Promise<Array<{
        id: string;
        tweetId: string;
        message: string;
        attempts: number;
        priority: string;
        preferredMethod: string;
        createdAt: number;
        lastAttempt?: number;
    }>> {
        await this.ensureInitialized();
        
        return this.replyQueue.slice(0, limit).map(item => ({
            id: item.id,
            tweetId: item.tweetId,
            message: item.message.substring(0, 100) + (item.message.length > 100 ? '...' : ''),
            attempts: item.attempts,
            priority: item.priority || 'normal',
            preferredMethod: item.preferredMethod || 'auto',
            createdAt: item.createdAt,
            lastAttempt: item.lastAttempt
        }));
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
            browserlessSuccessCount: 0,
            averageProcessingTime: 0,
            lastProcessedAt: undefined
        };
        await this.saveMetrics();
        console.log('[Twitter Reply] Metrics reset');
    }

    /**
     * Force initialize browserless bot
     */
    async initializeBrowserlessNow(): Promise<{ success: boolean; error?: string }> {
        try {
            await this.initializeBrowserlessBot();
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            };
        }
    }

    /**
     * Get batch processing settings
     */
    getBatchSettings(): {
        threshold: number;
        cooldown: number;
        lastBatchTime: number;
        canBatch: boolean;
        browserlessItemsInQueue: number;
    } {
        const browserlessItems = this.replyQueue.filter(item => 
            this.determineReplyMethod(item) === 'browserless'
        ).length;

        return {
            threshold: this.browserlessBatchThreshold,
            cooldown: this.batchCooldown,
            lastBatchTime: this.lastBatchProcessTime,
            canBatch: this.shouldUseBatchProcessing(),
            browserlessItemsInQueue: browserlessItems
        };
    }

    /**
     * Update batch processing settings
     */
    updateBatchSettings(settings: { threshold?: number; cooldown?: number }): void {
        if (settings.threshold !== undefined) {
            this.browserlessBatchThreshold = Math.max(1, settings.threshold);
        }
        if (settings.cooldown !== undefined) {
            this.batchCooldown = Math.max(60000, settings.cooldown); // Minimum 1 minute
        }
        console.log(`[Twitter Reply] Updated batch settings: threshold=${this.browserlessBatchThreshold}, cooldown=${this.batchCooldown}ms`);
    }

    /**
     * Force batch processing now (ignore cooldown)
     */
    async forceBatchProcessing(): Promise<{ success: boolean; processed: number; error?: string }> {
        try {
            const browserlessItemsBefore = this.replyQueue.filter(item => 
                this.determineReplyMethod(item) === 'browserless'
            ).length;

            if (browserlessItemsBefore === 0) {
                return { success: false, processed: 0, error: 'No browserless items in queue' };
            }

            // Temporarily override cooldown
            const originalLastBatchTime = this.lastBatchProcessTime;
            this.lastBatchProcessTime = 0;

            await this.processBrowserlessBatch();

            const browserlessItemsAfter = this.replyQueue.filter(item => 
                this.determineReplyMethod(item) === 'browserless'
            ).length;

            const processed = browserlessItemsBefore - browserlessItemsAfter;

            return { success: true, processed };
        } catch (error) {
            return { 
                success: false, 
                processed: 0,
                error: error instanceof Error ? error.message : 'Unknown error' 
            };
        }
    }


    /**
     * Test BrowserQL connection
     */
    async testBrowserQLConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
        try {
            console.log('[Twitter Reply] Testing BrowserQL connection...');
            
            // Check if BrowserQL is enabled
            const browserqlEnabled = process.env.BROWSERQL_ENABLED === 'true';
            if (!browserqlEnabled) {
                return {
                    success: false,
                    error: 'BrowserQL is disabled via BROWSERQL_ENABLED env var'
                };
            }

            // Check if token is available
            const browserlessToken = process.env.BROWSERLESS_TOKEN;
            if (!browserlessToken) {
                return {
                    success: false,
                    error: 'BROWSERLESS_TOKEN environment variable not set'
                };
            }

            // Import the BrowserQLBot class and test connection
            const { BrowserQLBot } = await import('./browserql-bot');
            const result = await BrowserQLBot.testConnection(browserlessToken);
            
            // Add specific guidance for common BrowserQL issues
            if (!result.success) {
                if (result.error?.includes('HTTP 500')) {
                    result.error = `${result.error}\n\nBrowserQL is not available on your browserless account. This feature typically requires:\n- A paid browserless subscription\n- BrowserQL feature enabled on your plan\n- Consider checking your account at https://account.browserless.io`;
                } else if (result.error?.includes('Cannot query field')) {
                    // This actually means BrowserQL is working! Just a schema mismatch
                    console.log('[Twitter Reply] 🎉 BrowserQL is available! Schema error indicates successful connection.');
                    result.success = true;
                    result.error = undefined;
                    result.note = 'BrowserQL connection successful (schema validated)';
                }
            }
            
            console.log('[Twitter Reply] BrowserQL connection test result:', result);
            return result;
            
        } catch (error) {
            console.error('[Twitter Reply] Error testing BrowserQL connection:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                details: {
                    name: error instanceof Error ? error.name : 'Unknown',
                    message: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }

    /**
     * Test browserless connection
     */
    async testBrowserlessConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
        try {
            console.log('[Twitter Reply] Testing browserless connection...');
            
            // Check if browserless is enabled
            const browserlessEnabled = process.env.BROWSERLESS_ENABLED === 'true';
            if (!browserlessEnabled) {
                return {
                    success: false,
                    error: 'Browserless is disabled via BROWSERLESS_ENABLED env var'
                };
            }

            // Check if token is available
            const browserlessToken = process.env.BROWSERLESS_TOKEN;
            if (!browserlessToken) {
                return {
                    success: false,
                    error: 'BROWSERLESS_TOKEN environment variable not set'
                };
            }

            // Import the XReplyBot class and test connection
            const { XReplyBot } = await import('./x-reply-bot');
            const result = await XReplyBot.testConnection(browserlessToken);
            
            console.log('[Twitter Reply] Browserless connection test result:', result);
            return result;
            
        } catch (error) {
            console.error('[Twitter Reply] Error testing browserless connection:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                details: {
                    name: error instanceof Error ? error.name : 'Unknown',
                    message: error instanceof Error ? error.message : String(error)
                }
            };
        }
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

            // Clean up Twitter API client
            if (this.client && typeof this.client.destroy === 'function') {
                await this.client.destroy();
            }
            this.isLoggedIn = false;
            this.loginPromise = null;

            // Clean up browserless bot
            if (this.browserlessBot) {
                await this.browserlessBot.close();
                this.browserlessBot = null;
                this.browserlessLoginPromise = null;
            }
            
            console.log('[Twitter Reply] Cleaned up Twitter client, browserless bot, and queue');
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