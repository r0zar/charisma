import { TwitterTriggerExecution } from './types';

/**
 * Twitter reply service for sending notifications when orders are executed
 */
export class TwitterReplyService {
    private client: any; // TwitterApi instance
    private isLoggedIn = false;
    private loginPromise: Promise<void> | null = null;

    constructor() {
        this.client = null;
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
     * Send a reply to a specific tweet
     */
    async replyToTweet(tweetId: string, message: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        try {
            // Check if replies are enabled
            const repliesEnabled = process.env.TWITTER_REPLIES_ENABLED !== 'false';
            if (!repliesEnabled) {
                console.log('[Twitter Reply] Replies disabled via TWITTER_REPLIES_ENABLED env var');
                return { success: false, error: 'Twitter replies disabled' };
            }

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
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        try {
            if (this.client && typeof this.client.destroy === 'function') {
                await this.client.destroy();
            }
            this.isLoggedIn = false;
            this.loginPromise = null;
            console.log('[Twitter Reply] Cleaned up Twitter client');
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