/**
 * Seed phrase generation and handling
 */
import type { Account } from './types';
import { getStxAddress, generateWallet, generateNewAccount, randomSeedPhrase } from '@stacks/wallet-sdk';
import { STACKS_MAINNET } from '@stacks/network';
import { getAddressFromPublicKey, privateKeyToPublic } from '@stacks/transactions';


/**
 * Generate a random seed phrase using crypto secure randomness
 * This is a simplified example - in production, use a proper BIP39 implementation
 */
export function generateSeedPhrase(): string {
  return randomSeedPhrase();
}

/**
 * Validate a seed phrase
 * In a real implementation, this would check for proper BIP39 structure
 */
export function validateSeedPhrase(phrase: string): boolean {
  // Basic validation - check for 12 words
  const words = phrase.trim().split(/\s+/);
  return words.length >= 12;
}

/**
 * Create a new account from a seed phrase
 */
export async function createAccountFromSeed(
  seedPhrase: string,
  seedPhraseId: string,
  index: number = 0,
): Promise<Account> {
  // The vault encrypts everything; wallet-sdk's own password encryption isn't used
  let wallet = await generateWallet({ secretKey: seedPhrase, password: "" });
  // generateWallet derives only the first account; derive up to the requested one
  while (wallet.accounts.length <= index) wallet = generateNewAccount(wallet);

  const privateKey = wallet.accounts[index].stxPrivateKey;
  const publicKey = privateKeyToPublic(privateKey);
  const stxAddress = getStxAddress(wallet.accounts[index], STACKS_MAINNET);

  // Generate a name from the address for display purposes
  const shortenedAddress = `${stxAddress.substring(0, 5)}...${stxAddress.substring(stxAddress.length - 4)}`;
  const name = `Account ${index + 1} (${shortenedAddress})`;

  // Create unique ID for the account
  const id = `account_${crypto.randomUUID()}`;

  return {
    id,
    name,
    index,
    seedPhraseId,
    stxAddress,
    privateKey,
    publicKey: publicKey.toString(),
    createdAt: Date.now(),
    isActive: false
  };
}