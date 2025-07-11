export interface TwitterTrigger {
    id: string;
    owner: string; // wallet address of trigger creator
    tweetUrl: string; // the tweet to monitor  
    tweetId: string; // extracted tweet ID

    // Order details (similar to LimitOrder)
    inputToken: string; // token contract id
    outputToken: string; // token contract id  
    amountIn: string; // micro units string
    targetPrice?: string; // price in micro units output per input - optional for immediate execution
    direction?: 'lt' | 'gt'; // direction of price comparison
    conditionToken?: string; // token whose price to watch, optional for immediate execution
    baseAsset?: string; // optional base asset contract id or 'USD'

    // Pre-signed order management
    orderIds?: string[]; // UUIDs of pre-signed manual orders
    availableOrders?: number; // cached count of unused orders

    // Twitter-specific settings
    isActive: boolean;
    maxTriggers?: number; // limit how many times it can trigger (null = unlimited)
    triggeredCount: number; // how many times it has been triggered

    // Metadata
    createdAt: string; // ISO timestamp
    lastChecked?: string; // ISO timestamp of last Twitter check
    signature: string; // signature for order creation authorization
}

export interface TwitterTriggerExecution {
    id: string;
    triggerId: string;
    replyTweetId: string;
    replierHandle: string; // Twitter username of the replier
    replierDisplayName: string; // Display name from Twitter profile
    bnsName: string; // extracted .btc name from handle/display name
    recipientAddress?: string; // resolved BNS -> Stacks address (if successful)
    orderUuid?: string; // created order UUID (if successful)
    txid?: string; // transaction ID for blockchain explorer link
    executedAt: string; // ISO timestamp
    status: 'pending' | 'bns_resolved' | 'order_broadcasted' | 'order_confirmed' | 'failed' | 'overflow';
    error?: string; // error message if failed

    // Twitter reply metadata
    replyText: string; // content of the reply
    replyCreatedAt: string; // when the reply was posted

    // Twitter notification tracking (optional)
    twitterReplyId?: string; // ID of the reply tweet we sent (if any)
    twitterReplyStatus?: 'sent' | 'failed' | 'disabled'; // Status of our reply notification
    twitterReplyError?: string; // Error message if reply failed
}

export interface BNSResolutionResult {
    bnsName: string;
    address?: string;
    success: boolean;
    error?: string;
}

export interface TwitterReply {
    id: string;
    text: string;
    authorHandle: string;
    authorDisplayName: string;
    createdAt: string;
    inReplyToTweetId: string;
}

export interface TwitterScrapingResult {
    success: boolean;
    replies: TwitterReply[];
    error?: string;
    lastScrapedAt: string;
}

// API request/response types
export interface CreateTwitterTriggerRequest {
    tweetUrl: string;
    inputToken: string;
    outputToken: string;
    amountIn: string;
    targetPrice?: string;
    direction?: 'lt' | 'gt';
    conditionToken?: string;
    baseAsset?: string;
    maxTriggers?: number;
    validFrom?: string;
    validTo?: string;
    signature: string;
    orderIds?: string[]; // Pre-signed order UUIDs
}

export interface TwitterTriggerWithStats extends TwitterTrigger {
    recentExecutions: TwitterTriggerExecution[];
    totalExecutions: number;
}