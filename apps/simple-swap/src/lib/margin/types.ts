export interface MarginAccount {
    owner: string;                   // User's wallet address
    totalBalance: number;            // Total deposited funds
    usedMargin: number;             // Margin locked in open positions  
    freeMargin: number;             // Available for new positions
    unrealizedPnL: number;          // P&L from all open positions
    accountEquity: number;          // totalBalance + unrealizedPnL
    marginRatio: number;            // usedMargin / accountEquity (risk %)

    // Account history
    depositHistory: DepositRecord[];
    withdrawHistory: WithdrawRecord[];

    // Preview mode settings
    isPreviewMode: boolean;
    previewStartingBalance: number;

    // Timestamps
    createdAt: string;              // ISO string
    lastUpdated: string;            // ISO string
}

export interface DepositRecord {
    id: string;
    amount: number;
    timestamp: string;
    type: 'deposit';
}

export interface WithdrawRecord {
    id: string;
    amount: number;
    timestamp: string;
    type: 'withdraw';
}

export interface MarginOperationRequest {
    owner: string;
    amount: number;
}

export interface MarginUpdateRequest {
    owner: string;
    usedMarginChange?: number;
    unrealizedPnL?: number;
} 