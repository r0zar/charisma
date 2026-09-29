/**
 * Wallet management types
 */

/**
 * Represents an account derived from a seed phrase
 */
export interface Account {
  // Unique identifier for the account
  id: string;

  // Human readable name for the account
  name: string;

  // Index within the HD path
  index: number;

  // The parent seed phrase ID this account belongs to
  seedPhraseId: string;

  // STX mainnet address
  stxAddress: string;

  // Private key for signing (encrypted when stored)
  privateKey: string;

  // Public key for verification
  publicKey: string;

  // Creation timestamp
  createdAt: number;

  // True if this is the active account
  isActive: boolean;
}

/**
 * Represents a seed phrase that can generate multiple accounts
 */
export interface SeedPhrase {
  // Unique identifier for the seed phrase
  id: string;

  // Human readable name/label
  name: string;

  // The seed phrase itself (encrypted when stored)
  phrase: string;

  // Creation timestamp
  createdAt: number;
}

/**
 * Interface for the wallet state
 */
export interface WalletState {
  seedPhrases: SeedPhrase[];
  accounts: Account[];
  activeAccountId: string | null;

  // Has the wallet been initialized with a password
  isInitialized: boolean;
}

/**
 * Options for account creation
 */
export interface CreateAccountOptions {
  seedPhraseId: string;
  index?: number;
  makeActive?: boolean;
}