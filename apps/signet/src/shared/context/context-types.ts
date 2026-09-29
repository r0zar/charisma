import type { MessagesSlice } from './slices/messagesSlice'
import type { BlockchainSlice } from './slices/blockchainSlice'
import type { WalletSlice } from './slices/walletSlice'

// Re-export types needed by consuming components
export type { BlockchainSlice } from './slices/blockchainSlice'

// Define the complete context type with all slices combined
export interface SignetContextType extends BlockchainSlice, WalletSlice, MessagesSlice { }