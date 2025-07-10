import { type AppSettings, type UIPreferences } from '@/schemas/user.schema';
import { type WalletState } from '@/schemas/wallet.schema';

/**
 * User settings data
 */
export const userSettingsData: AppSettings = {
  general: {
    isDarkMode: true,
    compactMode: true,
    autoRefresh: true
  },
  network: {
    network: "mainnet",
    rpcEndpoint: "https://stacks-node-api.testnet.stacks.co"
  },
  botDefaults: {
    defaultStrategy: "dca"
  },
  notifications: {
    trade: true,
    error: true,
    status: true,
    performance: true,
    security: true
  },
  notificationChannel: "webhook",
  security: {
    apiKey: "sk-37a3867f552c494a93fae81ed784144573c98b1b",
    autoLockTimeout: "30",
    requireConfirmation: true
  },
  advanced: {
    debugMode: false,
    performanceMonitoring: true
  }
};

/**
 * User preferences data
 */
export const userPreferencesData: UIPreferences = {
  sidebarCollapsed: false,
  theme: "dark",
  skin: "default",
  language: "zh",
  timezone: "Asia/Tokyo",
  dateFormat: "ISO",
  numberFormat: "US"
};

/**
 * User wallet data
 */
export const userWalletData: WalletState = {
  isConnected: true,
  address: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
  network: "devnet",
  balance: {
    stx: 178.3619255829904,
    tokens: [
      {
        contractId: "SP6T0M95QUKXYOM2W8JN6UCUCDPH75P7KDUEXH3S.stx",
        symbol: "STX",
        name: "Stacks",
        balance: 148,
        decimals: 6,
        usdValue: 0.0008650826224717767
      },
      {
        contractId: "SPIL2R9COFLOI78XNQ3ALEK7BW17PGJEWOET24K4.stx",
        symbol: "STX",
        name: "Stacks",
        balance: 78,
        decimals: 6,
        usdValue: 0.0007763144223501086
      },
      {
        contractId: "SPEBWR5GJIC3SZWGRBW5SIIQRBK0XPPSK9BK3X3M.welsh",
        symbol: "WELSH",
        name: "Welsh",
        balance: 61,
        decimals: 6,
        usdValue: 0.00003474175692572323
      },
      {
        contractId: "SP2JFF8JJ5ZSQ8NCNHFPRERUO96ON6SA9HMU52C6.pepe",
        symbol: "PEPE",
        name: "Pepe",
        balance: 61,
        decimals: 8,
        usdValue: 2.1234079990439616e-7
      },
      {
        contractId: "SPXR37HS8TJH4SBVW7FAI8FOPP49J9BBIAIALH0N.alex",
        symbol: "ALEX",
        name: "Alex",
        balance: 16,
        decimals: 8,
        usdValue: 0.000001126103726089773
      },
      {
        contractId: "SPJXNFYFSMN1AOLEYVDWAMX9KG6MWI7OMQ7YMVY9.stx",
        symbol: "STX",
        name: "Stacks",
        balance: 172,
        decimals: 6,
        usdValue: 0.0002722581846141552
      }
    ]
  },
  transactions: [
    {
      txId: "0xf7e9796c5cc91ebc8341700e6bddadb247b79af681595c6045a1cac25ae326bb",
      timestamp: "2025-07-10T01:55:36.942Z",
      type: "contract-call",
      amount: 3.424682784636488,
      token: "ALEX",
      status: "pending",
      fee: 0.007653703703703704
    },
    {
      txId: "0x124320fd59a8bf0944aeb64c2ec6139570ff2827565d227c59c5a891674e6b6c",
      timestamp: "2025-07-09T22:15:36.943Z",
      type: "contract-call",
      amount: 14.578630829903979,
      token: "USDA",
      status: "confirmed",
      fee: 0.0015065972222222223,
      blockHeight: 776265,
      memo: "Staking reward"
    },
    // ... continuing with the full transaction list
    // Truncated for brevity - the actual file would include all transactions
  ],
  connectionMethod: "hiro"
};