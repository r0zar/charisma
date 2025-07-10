import { z } from 'zod';
import { BotSchema, BotStatsSchema, BotActivitySchema, MarketDataSchema } from './bot.schema';

// Settings and preferences schemas
export const GeneralSettingsSchema = z.object({
  isDarkMode: z.boolean(),
  compactMode: z.boolean(),
  autoRefresh: z.boolean(),
});

export const NetworkSettingsSchema = z.object({
  network: z.enum(['mainnet', 'testnet', 'devnet']),
  rpcEndpoint: z.string().url(),
});

export const BotDefaultsSchema = z.object({
  defaultStrategy: z.enum(['yield-farming', 'dca', 'arbitrage', 'liquidity-mining']),
});

export const NotificationSettingsSchema = z.object({
  trade: z.boolean(),
  error: z.boolean(),
  status: z.boolean(),
  performance: z.boolean(),
  security: z.boolean(),
});

export const SecuritySettingsSchema = z.object({
  apiKey: z.string().min(1),
  autoLockTimeout: z.enum(['never', '15', '30', '60']),
  requireConfirmation: z.boolean(),
});

export const AdvancedSettingsSchema = z.object({
  debugMode: z.boolean(),
  performanceMonitoring: z.boolean(),
});

export const AppSettingsSchema = z.object({
  general: GeneralSettingsSchema,
  network: NetworkSettingsSchema,
  botDefaults: BotDefaultsSchema,
  notifications: NotificationSettingsSchema,
  notificationChannel: z.enum(['browser', 'email', 'webhook', 'disabled']),
  security: SecuritySettingsSchema,
  advanced: AdvancedSettingsSchema,
});

export const UIPreferencesSchema = z.object({
  sidebarCollapsed: z.boolean(),
  theme: z.enum(['light', 'dark']),
  skin: z.enum(['default', 'dark', 'ocean', 'sunset', 'forest', 'lavender']),
  language: z.enum(['en', 'es', 'fr', 'de', 'zh']),
  timezone: z.string().min(1),
  dateFormat: z.enum(['ISO', 'US', 'EU']),
  numberFormat: z.enum(['US', 'EU']),
});

export const TokenBalanceSchema = z.object({
  contractId: z.string().min(1),
  symbol: z.string().min(1),
  name: z.string().min(1),
  balance: z.number().int().min(0),
  decimals: z.number().int().min(0).max(18),
  image: z.string().optional(),
  usdValue: z.number().min(0).optional(),
});

export const WalletTransactionSchema = z.object({
  txId: z.string().min(1),
  timestamp: z.string().datetime(),
  type: z.enum(['send', 'receive', 'contract-call', 'deploy']),
  amount: z.number().min(0),
  token: z.string().min(1),
  status: z.enum(['pending', 'confirmed', 'failed']),
  blockHeight: z.number().int().min(0).optional(),
  fee: z.number().min(0),
  memo: z.string().optional(),
});

export const WalletStateSchema = z.object({
  isConnected: z.boolean(),
  address: z.string().nullable(),
  network: z.enum(['mainnet', 'testnet', 'devnet']),
  balance: z.object({
    stx: z.number().min(0),
    tokens: z.array(TokenBalanceSchema),
  }),
  transactions: z.array(WalletTransactionSchema),
  connectionMethod: z.enum(['hiro', 'xverse', 'ledger']).nullable(),
});

export const DeFiPoolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tokenA: z.string().min(1),
  tokenB: z.string().min(1),
  totalValueLocked: z.number().min(0),
  apr: z.number().min(0),
  volume24h: z.number().min(0),
  fees24h: z.number().min(0),
  liquidity: z.number().min(0),
});

export const NotificationStateSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['success', 'error', 'warning', 'info']),
  title: z.string().min(1),
  message: z.string().min(1),
  timestamp: z.string().datetime(),
  read: z.boolean(),
  persistent: z.boolean(),
  actionUrl: z.string().optional(),
});

export const AnalyticsDataSchema = z.object({
  totalValue: z.number().min(0),
  totalPnL: z.number(),
  activeBots: z.number().int().min(0),
  successRate: z.number().min(0).max(100),
  volumeToday: z.number().min(0),
  bestPerformer: z.string().min(1),
  worstPerformer: z.string().min(1),
  avgGasUsed: z.number().min(0),
  totalTransactions: z.number().int().min(0),
  profitableDays: z.number().int().min(0),
  totalDays: z.number().int().min(0),
  timeRange: z.enum(['24h', '7d', '30d', '90d', '1y']),
  chartData: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    value: z.number(),
    volume: z.number().min(0),
  })),
});

export const GeneratorMetadataSchema = z.object({
  version: z.string().min(1),
  generatedAt: z.string().datetime(),
  profile: z.enum(['development', 'demo', 'testing', 'production']),
  seed: z.number().int().optional(),
  botCount: z.number().int().min(0),
  realistic: z.boolean(),
});

export const GeneratorOptionsSchema = z.object({
  profile: z.enum(['development', 'demo', 'testing', 'production']),
  botCount: z.number().int().min(0).optional(),
  seed: z.number().int().optional(),
  realistic: z.boolean().optional(),
  daysOfHistory: z.number().int().min(1).max(365).optional(),
  includeErrors: z.boolean().optional(),
  realisticData: z.boolean().optional(),
  outputPath: z.string().optional(),
  targetWalletAddress: z.string().optional(),
});

export const StateValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  metadata: z.object({
    version: z.string(),
    botCount: z.number().int().min(0),
    totalActivities: z.number().int().min(0),
    dataSize: z.number().int().min(0),
  }),
});

export const AppStateSchema = z.object({
  metadata: GeneratorMetadataSchema,
  user: z.object({
    settings: AppSettingsSchema,
    wallet: WalletStateSchema,
    preferences: UIPreferencesSchema,
  }),
  bots: z.object({
    list: z.array(BotSchema),
    stats: BotStatsSchema,
    activities: z.array(BotActivitySchema),
  }),
  market: z.object({
    data: MarketDataSchema,
    analytics: AnalyticsDataSchema,
    pools: z.array(DeFiPoolSchema),
  }),
  notifications: z.array(NotificationStateSchema),
});

// Infer TypeScript types from schemas
export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;
export type NetworkSettings = z.infer<typeof NetworkSettingsSchema>;
export type BotDefaults = z.infer<typeof BotDefaultsSchema>;
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;
export type SecuritySettings = z.infer<typeof SecuritySettingsSchema>;
export type AdvancedSettings = z.infer<typeof AdvancedSettingsSchema>;
export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type UIPreferences = z.infer<typeof UIPreferencesSchema>;
export type TokenBalance = z.infer<typeof TokenBalanceSchema>;
export type WalletTransaction = z.infer<typeof WalletTransactionSchema>;
export type WalletState = z.infer<typeof WalletStateSchema>;
export type DeFiPool = z.infer<typeof DeFiPoolSchema>;
export type NotificationState = z.infer<typeof NotificationStateSchema>;
export type AnalyticsData = z.infer<typeof AnalyticsDataSchema>;
export type GeneratorMetadata = z.infer<typeof GeneratorMetadataSchema>;
export type GeneratorOptions = z.infer<typeof GeneratorOptionsSchema>;
export type StateValidationResult = z.infer<typeof StateValidationResultSchema>;
export type AppState = z.infer<typeof AppStateSchema>;