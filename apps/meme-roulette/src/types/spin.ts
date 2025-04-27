export interface Token {
    id: string; // Unique identifier (e.g., contract principal)
    name: string;
    symbol: string;
    imageUrl: string; // URL to token image
    userBalance: number; // Kept for potential future use, but not primary focus now
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
    type: 'update' | 'initial' | 'spin_result' | 'error';
    message?: string;
    lastUpdated: number; // Timestamp of the last data update
    initialTokens?: Token[]; // Optional: Sent only on the first connection message
    startTime: number; // Timestamp when the current spin countdown started
    endTime: number; // Timestamp when the current spin should end/lock
    winningTokenId?: string | null; // ID of the winning token (if determined)
    tokenVotes: Record<string, number>; // Map of tokenId -> total committed CHA
    myVotes?: Vote[]; // Array of the current user's votes in this round
}
