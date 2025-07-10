// Global Application State Type Definitions

// UI Preferences (not in settings context)
export interface UIPreferences {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  skin: 'default' | 'ocean' | 'sunset' | 'forest' | 'lavender';
  language: 'en' | 'es' | 'fr' | 'de' | 'zh';
  timezone: string;
  dateFormat: 'ISO' | 'US' | 'EU';
  numberFormat: 'US' | 'EU';
}

// Wallet State
export interface WalletState {
  isConnected: boolean;
  address: string | null;
  network: 'mainnet' | 'testnet' | 'devnet';
  balance: {
    stx: number;
    tokens: TokenBalance[];
  };
  transactions: WalletTransaction[];
  connectionMethod: 'hiro' | 'xverse' | 'ledger' | null;
}

export interface TokenBalance {
  contractId: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  image?: string;
  usdValue?: number;
}

export interface WalletTransaction {
  txId: string;
  timestamp: string;
  type: 'send' | 'receive' | 'contract-call' | 'deploy';
  amount: number;
  token: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockHeight?: number;
  fee: number;
  memo?: string;
}

// DeFi Pool Information

// Notification State


// Import schema-derived types instead of redefining them
export type {
  GeneratorMetadata,
  GeneratorOptions,
  AppState,
  NotificationState,
  AnalyticsData,
  DeFiPool,
  StateValidationResult
} from '@/schemas/app-state.schema';


// All interfaces are already exported via 'export interface' declarations above