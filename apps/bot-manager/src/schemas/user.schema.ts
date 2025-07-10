import { z } from 'zod';

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

// Infer TypeScript types from schemas
export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;
export type NetworkSettings = z.infer<typeof NetworkSettingsSchema>;
export type BotDefaults = z.infer<typeof BotDefaultsSchema>;
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;
export type SecuritySettings = z.infer<typeof SecuritySettingsSchema>;
export type AdvancedSettings = z.infer<typeof AdvancedSettingsSchema>;
export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type UIPreferences = z.infer<typeof UIPreferencesSchema>;