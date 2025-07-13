import { z } from 'zod';

/**
 * Sandbox configuration schema
 */
export const SandboxConfigSchema = z.object({
  runtime: z.enum(['node22', 'python3.13']).optional(),
  timeout: z.number().int().positive().optional(),
  teamId: z.string().optional(),
  projectId: z.string().optional(),
  token: z.string().optional(),
});

/**
 * Sandbox execution result schema
 */
export const SandboxExecutionResultSchema = z.object({
  success: z.boolean(),
  output: z.string().optional(),
  error: z.string().optional(),
  exitCode: z.number().int().optional(),
  executionTime: z.number().positive().optional(),
  sandboxId: z.string().optional(),
});

/**
 * Trading method result schemas
 */
export const SwapResultSchema = z.object({
  success: z.boolean(),
  txid: z.string().optional(),
  amountReceived: z.number().optional(),
  error: z.string().optional(),
});

export const LiquidityResultSchema = z.object({
  success: z.boolean(),
  txid: z.string().optional(),
  lpTokensReceived: z.number().optional(),
  error: z.string().optional(),
});

export const RemoveLiquidityResultSchema = z.object({
  success: z.boolean(),
  txid: z.string().optional(),
  tokensReceived: z.record(z.string(), z.number()).optional(),
  error: z.string().optional(),
});

export const ClaimRewardsResultSchema = z.object({
  success: z.boolean(),
  txid: z.string().optional(),
  amountClaimed: z.number().optional(),
  error: z.string().optional(),
});

export const StakeResultSchema = z.object({
  success: z.boolean(),
  txid: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Bot context schema for sandbox execution
 */
export const BotContextSchema = z.object({
  // Bot metadata
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(['active', 'paused', 'error', 'inactive', 'setup']),
  created_at: z.string().datetime(),
  last_active: z.string().datetime(),

  // Wallet credentials
  walletCredentials: z.object({
    privateKey: z.string().optional(),
  })
});

/**
 * Strategy execution options schema
 */
export const StrategyExecutionOptionsSchema = z.object({
  timeout: z.number().int().positive().optional(),
  enableLogs: z.boolean().optional(),
});

/**
 * Strategy execution result schema
 */
export const StrategyExecutionResultSchema = z.object({
  success: z.boolean(),
  result: z.any().optional(),
  logs: z.array(z.string()).optional(),
  error: z.string().optional(),
  executionTime: z.number().positive().optional(),
  sandboxId: z.string().optional(),
  botContext: BotContextSchema.partial().optional(),
  logsUrl: z.string().url().optional(),
  logsSize: z.number().int().min(0).optional(),
});

/**
 * API request schema for bot execution
 */
export const ApiExecuteRequestSchema = z.object({
  code: z.string().min(1),
  timeout: z.number().int().positive().optional(),
  enableLogs: z.boolean().optional(),
});

/**
 * API response schema for bot execution
 */
export const ApiExecuteResponseSchema = z.object({
  success: z.boolean(),
  result: z.any().optional(),
  logs: z.array(z.string()).optional(),
  error: z.string().optional(),
  executionTime: z.number().positive().optional(),
  sandboxId: z.string().optional(),
  botContext: z.any().optional(),
});

/**
 * Execution callbacks interface for optional real-time updates
 */
export interface ExecutionCallbacks {
  onStatus?: (message: string, timestamp?: string) => void;
  onLog?: (level: 'info' | 'error' | 'warn', message: string, timestamp?: string) => void;
  onResult?: (result: StrategyExecutionResult) => void;
}

// Infer TypeScript types from schemas
export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;
export type SandboxExecutionResult = z.infer<typeof SandboxExecutionResultSchema>;
export type SwapResult = z.infer<typeof SwapResultSchema>;
export type LiquidityResult = z.infer<typeof LiquidityResultSchema>;
export type RemoveLiquidityResult = z.infer<typeof RemoveLiquidityResultSchema>;
export type ClaimRewardsResult = z.infer<typeof ClaimRewardsResultSchema>;
export type StakeResult = z.infer<typeof StakeResultSchema>;
export type BotContext = z.infer<typeof BotContextSchema>;
export type StrategyExecutionOptions = z.infer<typeof StrategyExecutionOptionsSchema>;
export type StrategyExecutionResult = z.infer<typeof StrategyExecutionResultSchema>;
export type ApiExecuteRequest = z.infer<typeof ApiExecuteRequestSchema>;
export type ApiExecuteResponse = z.infer<typeof ApiExecuteResponseSchema>;