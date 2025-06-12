import { MarginAccount, MarginOperationRequest, MarginUpdateRequest, DepositRecord, WithdrawRecord } from './types';

// Simple in-memory store for preview mode (no DB needed)
const marginAccounts = new Map<string, MarginAccount>();

const PREVIEW_STARTING_BALANCE = 10000; // $10k starting balance

function recalculateAccount(account: MarginAccount): MarginAccount {
    // Recalculate derived values
    account.accountEquity = account.totalBalance + account.unrealizedPnL;
    account.freeMargin = Math.max(0, account.accountEquity - account.usedMargin);
    account.marginRatio = account.accountEquity > 0 ? (account.usedMargin / account.accountEquity) * 100 : 0;
    account.lastUpdated = new Date().toISOString();

    return account;
}

export async function getMarginAccount(owner: string): Promise<MarginAccount> {
    let account = marginAccounts.get(owner);

    if (!account) {
        // Create new account with starting balance
        account = {
            owner,
            totalBalance: PREVIEW_STARTING_BALANCE,
            usedMargin: 0,
            freeMargin: PREVIEW_STARTING_BALANCE,
            unrealizedPnL: 0,
            accountEquity: PREVIEW_STARTING_BALANCE,
            marginRatio: 0,
            depositHistory: [{
                id: 'initial',
                amount: PREVIEW_STARTING_BALANCE,
                timestamp: new Date().toISOString(),
                type: 'deposit'
            }],
            withdrawHistory: [],
            isPreviewMode: true,
            previewStartingBalance: PREVIEW_STARTING_BALANCE,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };

        marginAccounts.set(owner, account);
        console.log(`🆕 Created new margin account for ${owner} with $${PREVIEW_STARTING_BALANCE}`);
    }

    return recalculateAccount(account);
}

export async function depositMargin(req: MarginOperationRequest): Promise<MarginAccount> {
    const { owner, amount } = req;

    if (amount <= 0) {
        throw new Error('Deposit amount must be greater than 0');
    }

    if (amount > 1000000) {
        throw new Error('Maximum deposit is $1,000,000 in preview mode');
    }

    const account = await getMarginAccount(owner);

    const depositRecord: DepositRecord = {
        id: `deposit_${Date.now()}`,
        amount,
        timestamp: new Date().toISOString(),
        type: 'deposit'
    };

    account.totalBalance += amount;
    account.depositHistory.push(depositRecord);

    marginAccounts.set(owner, recalculateAccount(account));

    console.log(`💰 Deposit: ${owner} +$${amount} | New balance: $${account.totalBalance}`);

    return account;
}

export async function withdrawMargin(req: MarginOperationRequest): Promise<MarginAccount> {
    const { owner, amount } = req;

    if (amount <= 0) {
        throw new Error('Withdrawal amount must be greater than 0');
    }

    const account = await getMarginAccount(owner);

    if (amount > account.freeMargin) {
        throw new Error(`Insufficient free margin. Available: $${account.freeMargin.toFixed(2)}`);
    }

    // Safety check - don't allow withdrawal if it would make margin ratio too high
    const newTotalBalance = account.totalBalance - amount;
    const newAccountEquity = newTotalBalance + account.unrealizedPnL;
    const newMarginRatio = account.usedMargin > 0 ? (account.usedMargin / newAccountEquity) * 100 : 0;

    if (newMarginRatio > 80) {
        throw new Error('Cannot withdraw - would create high liquidation risk');
    }

    const withdrawRecord: WithdrawRecord = {
        id: `withdraw_${Date.now()}`,
        amount,
        timestamp: new Date().toISOString(),
        type: 'withdraw'
    };

    account.totalBalance -= amount;
    account.withdrawHistory.push(withdrawRecord);

    marginAccounts.set(owner, recalculateAccount(account));

    console.log(`💸 Withdrawal: ${owner} -$${amount} | New balance: $${account.totalBalance}`);

    return account;
}

export async function updateMarginUsage(req: MarginUpdateRequest): Promise<MarginAccount> {
    const { owner, usedMarginChange, unrealizedPnL } = req;

    const account = await getMarginAccount(owner);

    if (usedMarginChange !== undefined) {
        account.usedMargin = Math.max(0, account.usedMargin + usedMarginChange);
        console.log(`📊 Margin usage: ${owner} ${usedMarginChange >= 0 ? '+' : ''}$${usedMarginChange} | Used: $${account.usedMargin}`);
    }

    if (unrealizedPnL !== undefined) {
        account.unrealizedPnL = unrealizedPnL;
        console.log(`💹 P&L update: ${owner} ${unrealizedPnL >= 0 ? '+' : ''}$${unrealizedPnL.toFixed(2)}`);
    }

    marginAccounts.set(owner, recalculateAccount(account));

    return account;
}

export async function resetMarginAccount(owner: string): Promise<MarginAccount> {
    marginAccounts.delete(owner);
    console.log(`🔄 Reset margin account for ${owner}`);
    return await getMarginAccount(owner); // This will create a fresh account
}

// Utility functions for risk management
export function canOpenPosition(account: MarginAccount, marginRequired: number): boolean {
    return marginRequired <= account.freeMargin;
}

export function getMaxPositionSize(account: MarginAccount, leverage: number): number {
    if (leverage <= 0) return 0;
    return account.freeMargin * leverage;
}

export function getLiquidationRisk(account: MarginAccount): 'low' | 'medium' | 'high' {
    if (account.marginRatio > 80) return 'high';
    if (account.marginRatio > 50) return 'medium';
    return 'low';
}

export function isMarginCallLevel(account: MarginAccount): boolean {
    return account.marginRatio > 50; // Margin call at 50%
} 