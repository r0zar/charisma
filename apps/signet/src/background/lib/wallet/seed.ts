/**
 * Seed phrase generation and handling
 */
import type { Account } from './types';
import { getStxAddress, generateWallet, generateNewAccount, randomSeedPhrase } from '@stacks/wallet-sdk';
import { STACKS_MAINNET } from '@stacks/network';
import { getAddressFromPublicKey, privateKeyToPublic } from '@stacks/transactions';
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';


/**
 * A new random 24-word BIP39 seed phrase (256 bits of entropy)
 */
export function generateSeedPhrase(): string {
  return randomSeedPhrase(256);
}

/**
 * Whether a phrase is a real BIP39 seed phrase: English words from the list, a valid length, and a matching checksum
 */
export function validateSeedPhrase(phrase: string): boolean {
  return validateMnemonic(phrase.trim().toLowerCase().split(/\s+/).join(' '), wordlist);
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