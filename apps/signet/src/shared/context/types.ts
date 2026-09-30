// Define types for operations
export type MessageAction =
  // Lock
  | "initializeWallet"
  | "checkWalletInitialized"
  | "hasWallet"
  | "endWalletSession"
  | "resetWallet"
  | "exportWalletData"
  // Seed phrases
  | "createSeedPhrase"
  | "importSeedPhrase"
  | "generateSeedWords"
  | "getAllSeedPhrases"
  | "deleteSeedPhrase"
  // Accounts
  | "createAccount"
  | "getAccount"
  | "getAllAccounts"
  | "getAccountsForSeedPhrase"
  | "activateAccount"
  | "getCurrentAccount"
  | "deleteAccount"
  // Balances and sends
  | "getWalletBalances"
  | "getUsdPrices"
  | "sendToken"
  // Diagnostics
  | "getDiagnostics";

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

// Basic response structure
export interface HandlerResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
