import crypto from 'crypto';

/**
 * Wallet encryption utilities for securely storing bot credentials
 * Based on the approach used in simple-swap app
 */

function getEncryptionKey(): string {
  const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) {
    throw new Error('WALLET_ENCRYPTION_KEY environment variable is required');
  }
  return ENCRYPTION_KEY;
}

export interface EncryptedWalletData {
  encryptedMnemonic: string;
  encryptedPrivateKey: string;
  mnemonicIv: string;
  privateKeyIv: string;
  walletAddress: string;
}

export interface WalletCredentials {
  mnemonic: string;
  privateKey: string;
  walletAddress: string;
}

/**
 * Encrypts text using AES-256-CBC
 */
function encryptText(text: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(16);
  // Create a 32-byte key from the provided string using SHA-256
  const key = crypto.createHash('sha256').update(getEncryptionKey()).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { encrypted, iv: iv.toString('hex') };
}

/**
 * Decrypts text using AES-256-CBC
 */
function decryptText(encryptedText: string, iv: string): string {
  const key = crypto.createHash('sha256').update(getEncryptionKey()).digest();
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Encrypts wallet credentials for secure storage
 */
export function encryptWalletCredentials(credentials: WalletCredentials): EncryptedWalletData {
  const encryptedMnemonic = encryptText(credentials.mnemonic);
  const encryptedPrivateKey = encryptText(credentials.privateKey);

  return {
    encryptedMnemonic: encryptedMnemonic.encrypted,
    encryptedPrivateKey: encryptedPrivateKey.encrypted,
    mnemonicIv: encryptedMnemonic.iv,
    privateKeyIv: encryptedPrivateKey.iv,
    walletAddress: credentials.walletAddress
  };
}

/**
 * Decrypts wallet credentials from secure storage
 */
export function decryptWalletCredentials(encryptedData: EncryptedWalletData): WalletCredentials {
  const mnemonic = decryptText(encryptedData.encryptedMnemonic, encryptedData.mnemonicIv);
  const privateKey = decryptText(encryptedData.encryptedPrivateKey, encryptedData.privateKeyIv);

  return {
    mnemonic,
    privateKey,
    walletAddress: encryptedData.walletAddress
  };
}

/**
 * Generates a new wallet with mnemonic and private key
 * Uses @stacks/wallet-sdk for secure generation
 */
export async function generateBotWallet(): Promise<WalletCredentials> {
  // Import dynamically to avoid issues in browser environment
  const { randomSeedPhrase, generateWallet } = await import('@stacks/wallet-sdk');
  const { getAddressFromPrivateKey } = await import('@stacks/transactions');

  // Generate wallet data
  const mnemonic = randomSeedPhrase();
  
  // Generate wallet using the seed phrase
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: 'password'
  });

  // Extract wallet data
  const privateKey = wallet.accounts[0].stxPrivateKey;
  const walletAddress = getAddressFromPrivateKey(privateKey);

  return {
    mnemonic,
    privateKey,
    walletAddress
  };
}

/**
 * Safely extracts the private key from encrypted wallet data
 * Used for transaction signing in cron jobs
 */
export function getPrivateKeyForExecution(bot: { encryptedWallet?: string; walletIv?: string }): string | null {
  if (!bot.encryptedWallet || !bot.walletIv) {
    console.warn('Bot missing encrypted wallet data');
    return null;
  }

  try {
    // For now, we'll assume the encryptedWallet field contains the private key
    // In a full implementation, this would contain the full EncryptedWalletData
    return decryptText(bot.encryptedWallet, bot.walletIv);
  } catch (error) {
    console.error('Failed to decrypt bot wallet:', error);
    return null;
  }
}