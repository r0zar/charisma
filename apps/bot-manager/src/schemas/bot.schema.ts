import { z } from 'zod';

export const BotSchema = z.object({
  id: z.string().regex(/^S[PT][0-9A-Z]{37,39}$/, 'Invalid Stacks address format'), // Bot's wallet address
  name: z.string().min(1),
  strategy: z.string().min(1), // Full JavaScript code as string
  status: z.enum(['active', 'paused', 'error', 'inactive', 'setup']),
  ownerId: z.string().min(1), // Unique identifier for the authorizing user
  createdAt: z.string().datetime(),
  lastActive: z.string().datetime(),

  // Bot visual identity
  image: z.string().url().optional(), // Image URL
  imageType: z.enum(['pokemon', 'avatar', 'custom']).default('pokemon'),

  // Scheduling configuration
  cronSchedule: z.string().optional(), // Cron expression like "0 * * * *"
  lastExecution: z.string().datetime().optional(), // Last execution timestamp
  nextExecution: z.string().datetime().optional(), // Next scheduled execution
  executionCount: z.number().int().min(0).default(0), // Total executions

  // Wallet credentials (encrypted)
  encryptedWallet: z.string().optional(), // Encrypted wallet data
  walletIv: z.string().optional(), // Encryption IV
  publicKey: z.string().optional(), // Public key (safe to display)

  // Repository configuration (optional - defaults to charisma repo)
  gitRepository: z.string().url().optional(), // Custom git repository URL
  isMonorepo: z.boolean().optional(), // Whether the repo is a monorepo
  packagePath: z.string().optional(), // Subpath for monorepo packages (e.g., "bots/basic")
  buildCommands: z.array(z.string()).optional(), // Custom build commands

  // Package discovery (populated automatically)
  availablePackages: z.array(z.string()).optional(), // Discovered packages for IntelliSense
  lastAnalyzed: z.string().datetime().optional(), // Last repository analysis timestamp

  // Extended execution data (optional, populated when includeExecutions=true)
  executions: z.array(z.lazy(() => BotExecutionSchema)).optional(),
  executionStats: z.object({
    totalExecutions: z.number().int().min(0),
    successfulExecutions: z.number().int().min(0),
    failedExecutions: z.number().int().min(0),
    averageExecutionTime: z.number().optional(),
    lastSuccessfulExecution: z.string().datetime().optional(),
    lastFailedExecution: z.string().datetime().optional(),
  }).optional(),
  recentLogs: z.object({
    url: z.string().url(),
    size: z.number().int().min(0),
    timestamp: z.string().datetime(),
  }).optional(),
  schedulingInfo: z.object({
    isOverdue: z.boolean(),
    nextExecutionDescription: z.string().optional(),
    canExecute: z.boolean(),
    validationErrors: z.array(z.string()).optional(),
  }).optional(),

  // Extended state machine data (optional, populated when includeStateInfo=true)
  availableActions: z.array(z.string()).optional(),
  recommendedActions: z.array(z.string()).optional(),
  statusDescription: z.string().optional(),
  canStart: z.boolean().optional(),
  canPause: z.boolean().optional(),
  canStop: z.boolean().optional(),
  canReset: z.boolean().optional(),
  canReactivate: z.boolean().optional(),
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
  logsUrl: z.string().url().optional(), // Blob storage URL for execution logs
  logsSize: z.number().int().min(0).optional(), // Size of logs in bytes
});

export const CreateBotRequestSchema = z.object({
  name: z.string().min(1),
  strategy: z.string().min(1), // Full JavaScript code as string

  // Repository configuration (optional)
  gitRepository: z.string().url().optional(),
  isMonorepo: z.boolean().optional(),
  packagePath: z.string().optional(),
  buildCommands: z.array(z.string()).optional(),
});

export const BotStatsSchema = z.object({
  totalBots: z.number().int().min(0),
  activeBots: z.number().int().min(0),
  pausedBots: z.number().int().min(0),
  errorBots: z.number().int().min(0),
});

// Infer TypeScript types from schemas
export type Bot = z.infer<typeof BotSchema>;
export type BotExecution = z.infer<typeof BotExecutionSchema>;
export type CreateBotRequest = z.infer<typeof CreateBotRequestSchema>;
export type BotStats = z.infer<typeof BotStatsSchema>;
