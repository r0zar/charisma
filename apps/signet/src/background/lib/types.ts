import type { PostCondition } from '@stacks/transactions';
import type { TransactionType } from './constants';

// Core types
export interface TransferOptions {
    to: string;
    amount: number;
}

export interface PredictionOptions {
    marketId: number;
    outcomeId: number;
    amount: number;
}

export interface ClaimRewardOptions {
    receiptId: number;
}

export interface TxRequest {
    conditions: PostCondition[],
    function: {
        name: string,
        args: string[],
    },
    nonce: number;
    signature: string;
}

export interface TransactionRequest {
    type: TransactionType;
    subnetId: string;
    signature: string;
    signer?: string;
    nonce: number;
}

export interface Transfer extends TransactionRequest {
    type: TransactionType.TRANSFER;
    to: string;
    amount: number;
}

export interface Prediction extends TransactionRequest {
    type: TransactionType.PREDICT;
    marketId: string;
    outcomeId: number;
    amount: number;
}

export interface ClaimReward extends TransactionRequest {
    type: TransactionType.CLAIM_REWARD;
    receiptId: number;
}

export interface FinishedTxData {
    txId: string;
}

export interface TransactionResult {
    txid: string;
}

export interface TransferMessage {
    to: string;
    amount: number;
    nonce: number;
}

export interface PredictionMessage {
    marketId: number;
    outcomeId: number;
    amount: number;
    nonce: number;
}

export interface ClaimRewardMessage {
    receiptId: number;
    nonce: number;
}

export interface DepositOptions {
    subnet: `${string}.${string}`;
    amount: number;
    signer: string;
}

export interface WithdrawOptions {
    subnet: `${string}.${string}`;
    amount: number;
    signer: string;
}

export interface ServerConfig {
    privateKey: string | undefined;
}

// Base transaction interfaces
export interface BaseTransaction {
    type: TransactionType;
    affectedUsers: string[];
    getBalanceChanges(): Map<string, number>;
    toClarityValue(): any;
}