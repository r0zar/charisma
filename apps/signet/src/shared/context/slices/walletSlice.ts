import { useState } from 'react'
import type { Account, SeedPhrase } from '../types'
import { sendMessage } from '../utils'

export interface WalletState {
  /** Unlocked and ready to use */
  isWalletInitialized: boolean
  /** A wallet exists on this browser (locked or not) */
  hasWallet: boolean
  currentAccount: Account | null
  accounts: Account[]
  seedPhrases: SeedPhrase[]
}

export interface WalletActions {
  initializeWallet: (password: string) => Promise<boolean>
  createSeedPhrase: (name: string) => Promise<SeedPhrase | null>
  importSeedPhrase: (name: string, phrase: string) => Promise<SeedPhrase | null>
  getAllSeedPhrases: () => Promise<SeedPhrase[]>
  deleteSeedPhrase: (id: string) => Promise<boolean>
  createAccount: (seedPhraseId: string, makeActive?: boolean, index?: number) => Promise<Account | null>
  activateAccount: (id: string) => Promise<boolean>
  getCurrentAccount: () => Promise<Account | null>
  deleteAccount: (id: string) => Promise<boolean>
  resetWallet: () => Promise<boolean>
  refreshWalletState: () => Promise<void>
  checkWalletInitialization: () => Promise<void>
  endSession: () => Promise<boolean>
  exportWalletData: () => Promise<{ salt: string; iv: string; data: string }>
}

export type WalletSlice = WalletState & WalletActions

export function useWalletSlice(
  onAccountChange?: (account: Account | null) => void
): WalletSlice {
  // Initialize state for wallet
  const [isWalletInitialized, setIsWalletInitialized] = useState(false)
  const [hasWallet, setHasWallet] = useState(false)
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [seedPhrases, setSeedPhrases] = useState<SeedPhrase[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if wallet is initialized
  const checkWalletInitialization = async () => {
    setIsLoading(true);
    try {
      const [unlocked, exists] = await Promise.all([
        sendMessage<boolean>("checkWalletInitialized"),
        sendMessage<boolean>("hasWallet"),
      ]);
      setHasWallet(exists);
      setIsWalletInitialized(unlocked);

      if (unlocked) {
        await refreshWalletState();
      }
    } catch (err) {
      console.error("Error checking wallet initialization:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // Refresh wallet state (accounts, seed phrases, current account)
  const refreshWalletState = async () => {
    setIsLoading(true);
    try {
      // Get all accounts
      const allAccounts = await sendMessage<Account[]>("getAllAccounts");
      setAccounts(allAccounts);

      // Get all seed phrases
      const allSeedPhrases = await sendMessage<SeedPhrase[]>("getAllSeedPhrases");
      setSeedPhrases(allSeedPhrases);

      // Get current account
      const current = await sendMessage<Account | null>("getCurrentAccount");
      setCurrentAccount(current);

      // Notify parent if handler is provided
      if (onAccountChange) {
        onAccountChange(current);
      }
    } catch (err) {
      console.error("Error refreshing wallet state:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // Initialize wallet with password
  const initializeWallet = async (password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage<boolean>("initializeWallet", { password });
      setIsWalletInitialized(result);
      setHasWallet(true);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize wallet";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  // Create a new seed phrase
  const createSeedPhrase = async (name: string): Promise<SeedPhrase | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage<SeedPhrase | null>("createSeedPhrase", { name });
      if (result) {
        // Update state with new seed phrase
        setSeedPhrases(prev => [...prev, result]);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create seed phrase";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  // Import an existing seed phrase
  const importSeedPhrase = async (name: string, phrase: string): Promise<SeedPhrase | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage<SeedPhrase | null>("importSeedPhrase", { name, phrase });
      if (result) {
        // Update state with new seed phrase
        setSeedPhrases(prev => [...prev, result]);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to import seed phrase";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  // Get all seed phrases
  const getAllSeedPhrases = async (): Promise<SeedPhrase[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage<SeedPhrase[]>("getAllSeedPhrases");
      setSeedPhrases(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get seed phrases";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  // Delete a seed phrase
  const deleteSeedPhrase = async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage<boolean>("deleteSeedPhrase", { id });
      if (result) {
        // Remove from state
        setSeedPhrases(prev => prev.filter(sp => sp.id !== id));

        // Remove associated accounts
        setAccounts(prev => prev.filter(acc => acc.seedPhraseId !== id));

        // If current account was from this seed phrase, clear it
        if (currentAccount && currentAccount.seedPhraseId === id) {
          setCurrentAccount(null);
          if (onAccountChange) {
            onAccountChange(null);
          }
        }
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete seed phrase";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  // Create a new account from a seed phrase
  const createAccount = async (
    seedPhraseId: string,
    makeActive: boolean = false,
    index?: number
  ): Promise<Account | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage<Account | null>("createAccount", {
        seedPhraseId,
        makeActive,
        index
      });

      if (result) {
        // Add to accounts list
        setAccounts(prev => [...prev, result]);

        // If marked as active, update current account
        if (result.isActive) {
          setCurrentAccount(result);
          if (onAccountChange) {
            onAccountChange(result);
          }
        }
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create account";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  // Set an account as active
  const activateAccount = async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage<boolean>("activateAccount", { id });

      if (result) {
        // Update active status for all accounts
        const updatedAccounts = accounts.map(acc => ({
          ...acc,
          isActive: acc.id === id
        }));

        setAccounts(updatedAccounts);

        // Set current account
        const activated = updatedAccounts.find(acc => acc.id === id) || null;
        setCurrentAccount(activated);

        // Notify parent if handler is provided
        if (onAccountChange && activated) {
          onAccountChange(activated);
        }
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to activate account";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  // Get current active account
  const getCurrentAccount = async (): Promise<Account | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage<Account | null>("getCurrentAccount");
      setCurrentAccount(result);

      // Notify parent if handler is provided
      if (onAccountChange) {
        onAccountChange(result);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get current account";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  // Delete an account
  const deleteAccount = async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage<boolean>("deleteAccount", { id });

      if (result) {
        // Remove from accounts list
        setAccounts(prev => prev.filter(acc => acc.id !== id));

        // If it was the current account, clear it
        if (currentAccount && currentAccount.id === id) {
          await refreshWalletState(); // Get the new active account
        }
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete account";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  // Reset wallet (clear all data)
  const resetWallet = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage<boolean>("resetWallet");

      if (result) {
        // Clear all state
        setAccounts([]);
        setSeedPhrases([]);
        setCurrentAccount(null);
        if (onAccountChange) {
          onAccountChange(null);
        }
        setHasWallet(false);
        setIsWalletInitialized(false);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reset wallet";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  // End the current wallet session (logout)
  // Lock the wallet
  const endSession = async (): Promise<boolean> => {
    const result = await sendMessage<boolean>("endWalletSession");
    setIsWalletInitialized(false);
    setAccounts([]);
    setSeedPhrases([]);
    setCurrentAccount(null);
    return result;
  }
  
  // Export wallet data for backup
  const exportWalletData = () => sendMessage<{ salt: string; iv: string; data: string }>("exportWalletData");

  return {
    // State
    isWalletInitialized,
    hasWallet,
    currentAccount,
    accounts,
    seedPhrases,

    // Actions
    initializeWallet,
    createSeedPhrase,
    importSeedPhrase,
    getAllSeedPhrases,
    deleteSeedPhrase,
    createAccount,
    activateAccount,
    getCurrentAccount,
    deleteAccount,
    resetWallet,
    refreshWalletState,
    checkWalletInitialization,
    endSession,
    exportWalletData
  }
}