import { z } from 'zod';
import { BotSchema, BotStatsSchema } from './bot.schema';
import { AppSettingsSchema, UIPreferencesSchema } from './user.schema';
import { WalletStateSchema } from './wallet.schema';
// Market schema import removed
import { NotificationStateSchema } from './notification.schema';
import { AppMetadataSchema } from './app-metadata.schema';

// Re-export all schemas from their domain-specific files
export * from './user.schema';
export * from './wallet.schema';
// Market schema export removed
export * from './notification.schema';
export * from './app-metadata.schema';

// Main AppState schema that combines all domain schemas
export const AppStateSchema = z.object({
  metadata: AppMetadataSchema,
  user: z.object({
    settings: AppSettingsSchema,
    preferences: UIPreferencesSchema,
    wallet: WalletStateSchema,
  }),
  bots: z.object({
    list: z.array(BotSchema),
    stats: BotStatsSchema,
  }),
  notifications: z.array(NotificationStateSchema),
});

// Infer TypeScript types from schemas
export type AppState = z.infer<typeof AppStateSchema>;