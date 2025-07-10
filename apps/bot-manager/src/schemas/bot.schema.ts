import { z } from 'zod';

// Base schemas for reusable types
export const LpTokenBalanceSchema = z.object({
  contractId: z.string().min(1),
  symbol: z.string().min(1),
  name: z.string().min(1),
  balance: z.number().int().min(0),
  formattedBalance: z.number().min(0),
  decimals: z.number().int().min(0).max(18),
  image: z.string().optional(),
  usdValue: z.number().min(0).optional(),
});

export const RewardTokenBalanceSchema = z.object({
  contractId: z.string().min(1),
  symbol: z.string().min(1),
  name: z.string().min(1),
  balance: z.number().int().min(0),
  formattedBalance: z.number().min(0),
  decimals: z.number().int().min(0).max(18),
  image: z.string().optional(),
  usdValue: z.number().min(0).optional(),
});



export const BotExecutionSchema = z.object({
  id: z.string().min(1),
  botId: z.string().min(1),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  status: z.enum(['pending', 'success', 'failure', 'timeout']),
  output: z.string().optional(),
  error: z.string().optional(),
  transactionId: z.string().optional(),
  executionTime: z.number().int().min(0).optional(), // Execution time in milliseconds
  sandboxId: z.string().optional(), // Vercel Sandbox ID
});

export const BotSchema = z.object({
  id: z.string().regex(/^S[PT][0-9A-Z]{37,39}$/, 'Invalid Stacks address format'), // Bot's wallet address
  name: z.string().min(1),
  strategy: z.string().min(1), // Full JavaScript code as string
  status: z.enum(['active', 'paused', 'error', 'inactive', 'setup']),
  ownerId: z.string().regex(/^S[PT][0-9A-Z]{37,39}$/, 'Invalid Stacks address format'), // Owner's STX address
  createdAt: z.string().datetime(),
  lastActive: z.string().datetime(),
  
  // Bot visual identity
  image: z.string().url().optional(), // Image URL
  imageType: z.enum(['pokemon', 'avatar', 'custom']).default('pokemon'),
  
  // Scheduling configuration
  cronSchedule: z.string().optional(), // Cron expression like "0 * * * *"
  isScheduled: z.boolean().default(false), // Enable/disable automatic execution
  lastExecution: z.string().datetime().optional(), // Last execution timestamp
  nextExecution: z.string().datetime().optional(), // Next scheduled execution
  executionCount: z.number().int().min(0).default(0), // Total executions
  
  // Wallet credentials (encrypted)
  encryptedWallet: z.string().optional(), // Encrypted wallet data
  walletIv: z.string().optional(), // Encryption IV
  publicKey: z.string().optional(), // Public key (safe to display)
  
});

export const CreateBotRequestSchema = z.object({
  name: z.string().min(1),
  strategy: z.string().min(1), // Full JavaScript code as string
});

export const BotStatsSchema = z.object({
  totalBots: z.number().int().min(0),
  activeBots: z.number().int().min(0),
  pausedBots: z.number().int().min(0),
  errorBots: z.number().int().min(0),
});



// MarketData schema removed


// Infer TypeScript types from schemas
export type LpTokenBalance = z.infer<typeof LpTokenBalanceSchema>;
export type RewardTokenBalance = z.infer<typeof RewardTokenBalanceSchema>;
export type BotExecution = z.infer<typeof BotExecutionSchema>;
export type Bot = z.infer<typeof BotSchema>;
export type CreateBotRequest = z.infer<typeof CreateBotRequestSchema>;
export type BotStats = z.infer<typeof BotStatsSchema>;
// MarketData type removed
