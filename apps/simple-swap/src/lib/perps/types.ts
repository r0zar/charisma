export interface PerpetualPosition {
    // Basic position info
    owner: string;                    // User's address
    tradingPair: string;             // "STX/USDT"
    direction: 'long' | 'short';     // Position direction

    // Position sizing
    positionSize: string;            // Total position size in USD (as string)
    leverage: number;                // Leverage multiplier (2, 5, 10x, etc.)
    marginRequired: string;          // Actual collateral posted
    entryPrice?: string;             // Filled entry price (null when pending)

    // Risk management
    liquidationPrice: string;        // Auto-liquidation price
    stopLoss?: string;              // Optional stop loss price
    takeProfit?: string;            // Optional take profit price

    // Position lifecycle
    status: 'pending' | 'open' | 'closed';
    triggerPrice: string;           // Price at which position opens
    closeReason?: 'liquidated' | 'stop_loss' | 'take_profit' | 'manual';

    // Timestamps
    createdAt: string;              // ISO string
    entryTimestamp?: string;        // When position was triggered
    closeTimestamp?: string;        // When position was closed
    closePrice?: string;            // Price at which position closed

    // Funding tracking
    totalFundingFees: string;       // Accumulated funding fees
    lastFundingUpdate: string;      // Last funding calculation timestamp

    // Blockchain stuff  
    signature: string;              // 65-byte hex signature
    uuid: string;                   // Unique identifier
    baseAsset: string;             // Quote token contract (USDT, etc.)
    baseToken: string;             // Base token contract (STX, etc.)
}

export type NewPerpetualPositionRequest = Omit<PerpetualPosition,
    'status' | 'createdAt' | 'entryTimestamp' | 'closeTimestamp' |
    'entryPrice' | 'closePrice' | 'closeReason' | 'totalFundingFees' | 'lastFundingUpdate'
>; 