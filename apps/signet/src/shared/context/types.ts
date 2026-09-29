// Define types for operations
export type MessageAction =
  | "getStatus"
  | "getBalance"
  | "getBalances"
  | "getAssetBalances"
  | "processTx"
  | "createTransferTx"
  | "createPredictionTx"
  | "createClaimRewardTx"
  | "deposit"
  | "withdraw"
  | "refreshBalances"
  | "mineBlock"
  | "mineAllPendingBlocks"
  | "mineSingleTransaction"
  | "mineBatchTransactions"
  | "discardTransaction"
  | "setSigner"
  | "findTransactionBySignature"
  | "requestTransactionCustody"
  | "searchMempool"
  // Dex related actions
  | "deployTokenSubnet"
  | "generateSubnetCode"
  | "executeDexSwap"
  // Wallet related actions
  | "initializeWallet"
  | "checkWalletInitialized"
  | "hasWallet"
  | "endWalletSession"
  | "createSeedPhrase"
  | "importSeedPhrase"
  | "getAllSeedPhrases"
  | "deleteSeedPhrase"
  | "createAccount"
  | "getAccount"
  | "getAllAccounts"
  | "getAccountsForSeedPhrase"
  | "activateAccount"
  | "getCurrentAccount"
  | "deleteAccount"
  | "resetWallet"
  | "exportWalletData"
  | "getWalletBalances"
  | "sendToken";

// Wallet types
export interface SeedPhrase {
  id: string;
  name: string;
  createdAt: number;
}

export interface Account {
  id: string;
  name: string;
  index: number;
  seedPhraseId: string;
  stxAddress: string;
  publicKey: string;
  createdAt: number;
  isActive: boolean;
}

// Transaction interfaces
export interface TransactionRequest {
  type: string;
  subnetId: string;
  signature: string;
  signer: string;
  nonce: number;
}

export interface Transfer extends TransactionRequest {
  type: 'transfer';
  to: string;
  amount: number;
}

export interface Prediction extends TransactionRequest {
  type: 'predict';
  marketId: number;
  outcomeId: number;
  amount: number;
}

export interface ClaimReward extends TransactionRequest {
  type: 'claim-reward';
  receiptId: number;
}

export interface TransactionResult {
  txid: string;
}

export interface Status {
  subnet: `${string}.${string}`;
  signer: string;
  token: string;
  txQueue: any[]; // Using any instead of Transaction to avoid circular dependency
}

// Basic response structure
export interface HandlerResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Message from SDK
export interface Message {
  type: string;
  data?: any;
  timestamp: number;
}