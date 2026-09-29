/**
 * The vault: wallet state encrypted with a key derived from the password (PBKDF2-SHA256 → AES-GCM).
 *
 * The password is never stored. While unlocked, the derived key sits in chrome.storage.session:
 * memory only, readable by the background alone, gone when the browser closes, and cleared after
 * 15 idle minutes. A wrong password fails AES-GCM authentication and is rejected.
 */
import type { SeedPhrase, Account, WalletState } from './types';

const VAULT_KEY = 'vault';
const UNLOCKED_KEY = 'unlocked';
/** Plaintext password left in chrome.storage.local by the old session code */
const LEGACY_SESSION_KEY = 'wallet_session';

const LOCK_AFTER_MS = 15 * 60 * 1000;
const PBKDF2_ITERATIONS = 600_000;
const MIN_PASSWORD_LENGTH = 8;

interface Vault {
  salt: string;
  iv: string;
  data: string;
}

interface Unlocked {
  /** Raw AES key, base64 */
  key: string;
  expiresAt: number;
}

const toBase64 = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(Array.from(new Uint8Array(bytes), b => String.fromCharCode(b)).join(''));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

async function readVault(): Promise<Vault | undefined> {
  const { [VAULT_KEY]: vault } = await chrome.storage.local.get(VAULT_KEY);
  return vault;
}

async function decrypt(key: CryptoKey, vault: Vault): Promise<WalletState> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(vault.iv) }, key, fromBase64(vault.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

async function encrypt(key: CryptoKey, salt: string, state: WalletState): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(state)));
  const vault: Vault = { salt, iv: toBase64(iv), data: toBase64(data) };
  await chrome.storage.local.set({ [VAULT_KEY]: vault });
}

async function startSession(key: CryptoKey): Promise<void> {
  const unlocked: Unlocked = { key: toBase64(await crypto.subtle.exportKey('raw', key)), expiresAt: Date.now() + LOCK_AFTER_MS };
  await chrome.storage.session.set({ [UNLOCKED_KEY]: unlocked });
}

/** The unlocked key, sliding the auto-lock forward. Throws when locked. */
async function sessionKey(): Promise<CryptoKey> {
  const { [UNLOCKED_KEY]: unlocked } = (await chrome.storage.session.get(UNLOCKED_KEY)) as { [UNLOCKED_KEY]?: Unlocked };
  if (!unlocked) throw new Error('Wallet is locked');
  if (Date.now() > unlocked.expiresAt) {
    await lock();
    throw new Error('Wallet locked after 15 minutes of inactivity');
  }
  await chrome.storage.session.set({ [UNLOCKED_KEY]: { ...unlocked, expiresAt: Date.now() + LOCK_AFTER_MS } });
  return crypto.subtle.importKey('raw', fromBase64(unlocked.key), 'AES-GCM', true, ['encrypt', 'decrypt']);
}

/** Drop the plaintext password the old session code kept in local storage. */
export async function removeLegacySession(): Promise<void> {
  await chrome.storage.local.remove(LEGACY_SESSION_KEY);
}

/** Whether a wallet has been created on this browser (locked or not). */
export async function hasWallet(): Promise<boolean> {
  return !!(await readVault());
}

/** Whether the wallet is unlocked right now. */
export async function isUnlocked(): Promise<boolean> {
  try {
    await sessionKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Unlock the wallet, or create it with this password if there isn't one yet.
 * Throws "Wrong password" when the password doesn't open the existing wallet.
 */
export async function unlockOrCreate(password: string): Promise<void> {
  const vault = await readVault();

  if (!vault) {
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(password, salt);
    await encrypt(key, toBase64(salt), { seedPhrases: [], accounts: [], activeAccountId: null, isInitialized: true });
    await startSession(key);
    return;
  }

  const key = await deriveKey(password, fromBase64(vault.salt));
  try {
    await decrypt(key, vault);
  } catch {
    throw new Error('Wrong password');
  }
  await startSession(key);
}

/** Lock the wallet: forget the key until the password is entered again. */
export async function lock(): Promise<void> {
  await chrome.storage.session.remove(UNLOCKED_KEY);
}

export async function getWalletState(): Promise<WalletState> {
  const vault = await readVault();
  if (!vault) throw new Error('No wallet yet');
  return decrypt(await sessionKey(), vault);
}

async function saveWalletState(state: WalletState): Promise<void> {
  const vault = await readVault();
  if (!vault) throw new Error('No wallet yet');
  await encrypt(await sessionKey(), vault.salt, state);
}

/** The encrypted vault as stored, for backup: it opens only with the password. */
export async function exportVault(): Promise<Vault> {
  const vault = await readVault();
  if (!vault) throw new Error('No wallet yet');
  await sessionKey();
  return vault;
}

/**
 * Add a new seed phrase to the wallet
 */
export async function addSeedPhrase(name: string, phrase: string): Promise<SeedPhrase> {
  const state = await getWalletState();
  if (state.seedPhrases.some(sp => sp.name === name)) {
    throw new Error(`A seed phrase with name "${name}" already exists`);
  }

  const seedPhrase: SeedPhrase = { id: `seed_${crypto.randomUUID()}`, name, phrase, createdAt: Date.now() };
  state.seedPhrases.push(seedPhrase);
  await saveWalletState(state);
  return seedPhrase;
}

export async function getSeedPhrase(id: string): Promise<SeedPhrase | null> {
  const state = await getWalletState();
  return state.seedPhrases.find(sp => sp.id === id) ?? null;
}

export async function getAllSeedPhrases(): Promise<SeedPhrase[]> {
  return (await getWalletState()).seedPhrases;
}

/**
 * Delete a seed phrase and all its accounts
 */
export async function deleteSeedPhrase(id: string): Promise<boolean> {
  const state = await getWalletState();
  state.seedPhrases = state.seedPhrases.filter(sp => sp.id !== id);
  state.accounts = state.accounts.filter(acc => acc.seedPhraseId !== id);

  if (state.activeAccountId && !state.accounts.some(acc => acc.id === state.activeAccountId)) {
    state.activeAccountId = state.accounts[0]?.id ?? null;
    state.accounts.forEach(acc => { acc.isActive = acc.id === state.activeAccountId; });
  }

  await saveWalletState(state);
  return true;
}

/**
 * Add a new account derived from a seed phrase
 */
export async function addAccount(account: Account): Promise<boolean> {
  const state = await getWalletState();
  state.accounts.push(account);

  // The first account, or one marked active, becomes the only active account
  if (!state.activeAccountId || account.isActive) {
    state.activeAccountId = account.id;
    state.accounts.forEach(acc => { acc.isActive = acc.id === account.id; });
  }

  await saveWalletState(state);
  return true;
}

export async function getAccount(id: string): Promise<Account | null> {
  const state = await getWalletState();
  return state.accounts.find(acc => acc.id === id) ?? null;
}

export async function getAllAccounts(): Promise<Account[]> {
  return (await getWalletState()).accounts;
}

export async function getAccountsForSeedPhrase(seedPhraseId: string): Promise<Account[]> {
  return (await getWalletState()).accounts.filter(acc => acc.seedPhraseId === seedPhraseId);
}

export async function setActiveAccount(id: string): Promise<boolean> {
  const state = await getWalletState();
  if (!state.accounts.some(acc => acc.id === id)) throw new Error('Account not found');

  state.accounts.forEach(acc => { acc.isActive = acc.id === id; });
  state.activeAccountId = id;
  await saveWalletState(state);
  return true;
}

export async function getActiveAccount(): Promise<Account | null> {
  const state = await getWalletState();
  return state.accounts.find(acc => acc.id === state.activeAccountId) ?? null;
}

export async function deleteAccount(id: string): Promise<boolean> {
  const state = await getWalletState();
  state.accounts = state.accounts.filter(acc => acc.id !== id);

  if (state.activeAccountId === id) {
    state.activeAccountId = state.accounts[0]?.id ?? null;
    state.accounts.forEach(acc => { acc.isActive = acc.id === state.activeAccountId; });
  }

  await saveWalletState(state);
  return true;
}

/**
 * Delete the wallet entirely. The next password entered creates a new one.
 */
export async function deleteWallet(): Promise<boolean> {
  await sessionKey();
  await chrome.storage.local.remove(VAULT_KEY);
  await lock();
  return true;
}
