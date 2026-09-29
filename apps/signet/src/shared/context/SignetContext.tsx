import React, { createContext, useContext, useEffect, type ReactNode } from 'react'
import { subscribe, type Message } from 'signet-sdk/src/messaging'
import type { SignetContextType } from './context-types'
import { useMessagesSlice } from './slices/messagesSlice'
import { useBlockchainSlice } from './slices/blockchainSlice'
import { useWalletSlice } from './slices/walletSlice'
import type { Account, SeedPhrase, Status } from './types'

// Create a minimal default context with error handling
const defaultContext: SignetContextType = {
  // Messages state
  messages: [],
  pendingPermissions: [],
  clearMessages: () => { },
  addMessage: () => { },
  handleSDKMessage: () => { },
  approvePermission: () => { },
  denyPermission: () => { },
  rememberPermission: () => { },

  // Subnet state
  status: null,
  isLoading: false,
  error: null,

  // Utility operations
  getAssetBalances: async () => { throw new Error("Context not initialized") },
  getBalance: async () => { throw new Error("Context not initialized") },
  getBalances: async () => { throw new Error("Context not initialized") },
  deposit: async () => { throw new Error("Context not initialized") },
  withdraw: async () => { throw new Error("Context not initialized") },
  refreshBalances: async () => { throw new Error("Context not initialized") },
  refreshStatus: async () => { throw new Error("Context not initialized") },

  // Transaction operations
  createTransfer: async () => { throw new Error("Context not initialized") },
  discardTransaction: async () => { throw new Error("Context not initialized") },
  mineSingleTransaction: async () => { throw new Error("Context not initialized") },
  mineBatchTransactions: async () => { throw new Error("Context not initialized") },
  // createPrediction: async () => { throw new Error("Context not initialized") },
  // createClaimReward: async () => { throw new Error("Context not initialized") },

  // Wallet state
  isWalletInitialized: false,
  hasWallet: false,
  currentAccount: null,
  accounts: [],
  seedPhrases: [],

  // Wallet operations
  initializeWallet: async () => { throw new Error("Context not initialized") },
  createSeedPhrase: async () => { throw new Error("Context not initialized") },
  importSeedPhrase: async () => { throw new Error("Context not initialized") },
  getAllSeedPhrases: async () => { throw new Error("Context not initialized") },
  deleteSeedPhrase: async () => { throw new Error("Context not initialized") },
  createAccount: async () => { throw new Error("Context not initialized") },
  activateAccount: async () => { throw new Error("Context not initialized") },
  getCurrentAccount: async () => { throw new Error("Context not initialized") },
  deleteAccount: async () => { throw new Error("Context not initialized") },
  resetWallet: async () => { throw new Error("Context not initialized") },
  refreshWalletState: async () => { throw new Error("Context not initialized") },
  checkWalletInitialization: async () => { throw new Error("Context not initialized") },
  endSession: async () => { throw new Error("Context not initialized") },
  exportWalletData: async () => { throw new Error("Context not initialized") },
}

// Create context
const SignetContext = createContext<SignetContextType>(defaultContext)

// Provider props
interface SignetProviderProps {
  children: ReactNode
}

// The actual provider component
export function SignetProvider({ children }: SignetProviderProps) {
  // Use the Wallet slice first
  const walletSlice = useWalletSlice();

  // Initialize blockchain slice with the current account's stxAddress
  const blockchainSlice = useBlockchainSlice(walletSlice.currentAccount?.stxAddress || null);

  // Initialize message slice with blockchain slice for status refresh and operations
  const messagesSlice = useMessagesSlice(blockchainSlice);

  // Setup message subscriber
  useEffect(() => {
    // Subscribe to all messages and handle SDK messages
    const unsubscribe = subscribe(messagesSlice.handleSDKMessage);
    // Cleanup on unmount
    return unsubscribe;
  }, []);

  // Get initial status and wallet state
  useEffect(() => {
    blockchainSlice.refreshStatus();
    walletSlice.checkWalletInitialization();
  }, []);

  // Create context value by merging all slices and adding dynamic signer
  const contextValue: SignetContextType = {
    ...blockchainSlice,
    ...walletSlice,
    ...messagesSlice
  };

  return (
    <SignetContext.Provider value={contextValue}>
      {children}
    </SignetContext.Provider>
  );
}

// Custom hook for using the context
export function useSignetContext() {
  const context = useContext(SignetContext);
  if (context === undefined) {
    throw new Error('useSignetContext must be used within a SignetProvider');
  }
  return context;
}

// Re-export types for convenience
export type { Account, SeedPhrase, Status, Message };