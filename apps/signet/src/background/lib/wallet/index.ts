/**
 * Wallet manager for handling seed phrases and accounts
 */
import {
  hasWallet,
  isUnlocked,
  unlockOrCreate,
  lock,
  exportVault,
  addSeedPhrase,
  getSeedPhrase,
  getAllSeedPhrases,
  deleteSeedPhrase,
  addAccount,
  getAccount,
  getAllAccounts,
  getAccountsForSeedPhrase,
  setActiveAccount,
  getActiveAccount,
  deleteAccount,
  deleteWallet,
  lockExpiresAt
} from './storage';

import {
  generateSeedPhrase,
  validateSeedPhrase,
  createAccountFromSeed
} from './seed';

import type {
  SeedPhrase,
  Account,
  WalletState,
  CreateAccountOptions
} from './types';

/**
 * Unlock the wallet with its password, or create it if this browser has none yet
 */
export async function initializeWallet(password: string): Promise<boolean> {
  await unlockOrCreate(password);
  return true;
}

/**
 * Whether the wallet is unlocked and ready to use
 */
export async function checkWalletInitialized(): Promise<boolean> {
  return await isUnlocked();
}

/**
 * Lock the wallet
 */
export async function endSession(): Promise<boolean> {
  await lock();
  return true;
}

/**
 * Generate and store a new seed phrase
 */
export async function createNewSeedPhrase(name: string): Promise<SeedPhrase | null> {
  // Generate a new random seed phrase
  const phrase = generateSeedPhrase();

  // Store it securely
  return await addSeedPhrase(name, phrase);
}

/**
 * Import an existing seed phrase
 */
export async function importSeedPhrase(name: string, phrase: string): Promise<SeedPhrase | null> {
  // Validate the seed phrase
  if (!validateSeedPhrase(phrase)) {
    throw new Error("Invalid seed phrase");
  }

  // Store it securely
  return await addSeedPhrase(name, phrase);
}

/**
 * Create a new account from a seed phrase
 */
export async function createAccount(options: CreateAccountOptions): Promise<Account | null> {
  // Get the seed phrase
  const seedPhrase = await getSeedPhrase(options.seedPhraseId);
  if (!seedPhrase) {
    throw new Error("Seed phrase not found");
  }

  // Find the next available index if not specified
  const index = options.index ?? await getNextAccountIndex(options.seedPhraseId);

  const account = await createAccountFromSeed(seedPhrase.phrase, seedPhrase.id, index);

  // Set active status
  account.isActive = !!options.makeActive;

  // Store the account
  const success = await addAccount(account);

  if (success) {
    return account;
  }

  return null;
}

/**
 * Get the next available account index for a seed phrase
 */
async function getNextAccountIndex(seedPhraseId: string): Promise<number> {
  const accounts = await getAccountsForSeedPhrase(seedPhraseId);

  if (accounts.length === 0) {
    return 0;
  }

  // Find the highest index and add 1
  return Math.max(...accounts.map(acc => acc.index)) + 1;
}

/**
 * Change the active account
 */
export async function activateAccount(accountId: string): Promise<boolean> {
  return await setActiveAccount(accountId);
}

/**
 * Get the currently active account
 */
export async function getCurrentAccount(): Promise<Account | null> {
  return await getActiveAccount();
}

/**
 * Delete the wallet (all seed phrases and accounts)
 */
export async function resetWallet(): Promise<boolean> {
  return await deleteWallet();
}

// Re-export storage functions and types for convenience
export {
  hasWallet,
  exportVault,
  lockExpiresAt,
  getSeedPhrase,
  getAllSeedPhrases,
  deleteSeedPhrase,
  getAccount,
  getAllAccounts,
  getAccountsForSeedPhrase,
  deleteAccount,
  type SeedPhrase,
  type Account,
  type WalletState
};