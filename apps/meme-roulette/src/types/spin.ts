export interface Token {
    type: string
    id: string; // Unique identifier (e.g., contract principal)
    name: string;
    symbol: string;
    imageUrl: string; // URL to token image
    userBalance: number; // Kept for potential future use, but not primary focus now
    decimals: number; // Number of decimal places for the token
    contractId: string
    base?: string; // contractId of the regular token if this is a SUBNET token
}

/**
 * Represents a single user's vote on a specific token.
 */
export interface Vote {
    id: string; // Unique vote ID
    tokenId: string; // ID of the token voted on
    voteAmountCHA: number;  // Amount of CHA committed/voted
    voteTime: number; // Timestamp of the vote
    userId: string; // Identifier for the user placing the vote (placeholder)
}

/**
 * User validation status for multi-stage spin
 */
export interface UserValidation {
    userId: string;
    hasValidBalance: boolean;
    totalCommitted: number;
    currentBalance: string;
    votes: Vote[];
    balanceShortfall?: number;
}

/**
 * Complete validation results for all users
 */
export interface ValidationResults {
    validUsers: UserValidation[];
    invalidUsers: UserValidation[];
    validTokenBets: Record<string, number>;
    totalValidCHA: number;
    totalInvalidCHA: number;
    validationTimestamp: number;
}

/**
 * Represents data for a new vote notification
 */
export interface NewVoteData {
    voteId: string; // Unique ID for this vote
    tokenId: string; // ID of the token voted on
    amount: number; // Amount of CHA committed
    timestamp: number; // When the vote occurred
    userId: string; // ID of the user who placed the vote
}

/**
 * Represents the overall state of a single token in the spin cycle.
 */
export interface TokenSpinInfo {
    token: Token;
    // totalBetCHA: number; // REMOVED - Replaced by tokenBets
    percentage: number; // Percentage chance based on current commitments
    tokenVotes: Record<string, number>; // Map of tokenId -> total CHA committed/voted on that token
}

// Data structure for the Server-Sent Events feed
export interface SpinFeedData {
    type: 'update' | 'initial' | 'spin_result' | 'error' | 'new_vote' | 'spin_starting' | 'validation_complete';
    message?: string;
    lastUpdated: number; // Timestamp of the last data update
    initialTokens?: Token[]; // Optional: Sent only on the first connection message
    startTime: number; // Timestamp when the current spin countdown started
    endTime: number; // Timestamp when the current spin should end/lock
    winningTokenId?: string | null; // ID of the winning token (if determined)
    tokenVotes: Record<string, number>; // Map of tokenId -> total committed CHA
    myVotes?: Vote[]; // Array of the current user's votes in this round
    currentUserBets?: Vote[]; // Current user's bets in this round
    roundDuration: number; // Duration of the current round in milliseconds
    lockDuration?: number; // Duration of the lock period before spin in milliseconds
    newVote?: NewVoteData; // Data for a new vote notification (only present when type is 'new_vote')
    athTotalAmount?: number; // All-Time High total CHA amount from any single round
    previousRoundAmount?: number; // Total CHA amount from the previous completed round
    // Multi-stage spin data
    validationResults?: ValidationResults; // User validation results for spin
    spinPhase?: 'starting' | 'validating' | 'ready' | 'spinning' | 'complete';
}
