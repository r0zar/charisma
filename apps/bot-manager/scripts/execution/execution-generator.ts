/**
 * Execution Data Generator
 * Utilities for generating realistic bot execution records for development and testing
 */

import { randomUUID } from 'crypto';
import { BotExecution } from '@/schemas/bot.schema';
import { ExecutionLogService } from '@/lib/services/bots';
import { SeededRandom } from '../data/generators/helpers';
import { syncLogger as logger } from '../utils/logger';

// Realistic execution scenarios
const EXECUTION_SCENARIOS = [
  {
    type: 'successful_swap',
    weight: 0.4,
    statusOptions: ['success'] as const,
    outputs: [
      'Strategy executed successfully. Swapped 500000 µSTX for USDA.',
      'Strategy executed successfully. Swapped 750000 µSTX for USDA.',
      'Strategy executed successfully. Swapped 1000000 µSTX for USDA.',
      'Strategy executed successfully. No action taken - balance below threshold.',
      'Strategy executed successfully. No action taken - market conditions unfavorable.',
    ],
    executionTimeRange: [1500, 5000],
    hasTransaction: true
  },
  {
    type: 'failed_execution',
    weight: 0.25,
    statusOptions: ['failure'] as const,
    outputs: [''],
    errors: [
      'Insufficient balance for swap operation',
      'Network timeout during transaction',
      'Invalid token contract address',
      'Slippage tolerance exceeded',
      'Contract call failed: insufficient allowance'
    ],
    executionTimeRange: [1000, 3000],
    hasTransaction: false
  },
  {
    type: 'timeout',
    weight: 0.15,
    statusOptions: ['timeout'] as const,
    outputs: [''],
    errors: [
      'Execution timed out after 120 seconds',
      'Execution timed out after 180 seconds',
    ],
    executionTimeRange: [120000, 180000],
    hasTransaction: false
  },
  {
    type: 'successful_monitoring',
    weight: 0.2,
    statusOptions: ['success'] as const,
    outputs: [
      'Strategy executed successfully. Monitoring price - no action needed.',
      'Strategy executed successfully. Current price within target range.',
      'Strategy executed successfully. Waiting for better entry point.',
    ],
    executionTimeRange: [800, 2000],
    hasTransaction: false
  }
] as const;

const SAMPLE_LOG_CONTENT = {
  successful_swap: `=== Strategy Output ===
[INFO] Starting strategy execution...
[INFO] Checking wallet balance: 2500000 µSTX
[INFO] Current USDA price: 0.998 STX
[INFO] Price within acceptable range, executing swap
[INFO] Preparing swap transaction...
[INFO] Swap transaction broadcast: 0x...
[INFO] Transaction confirmed after 3 blocks
[INFO] Swap completed successfully

=== Raw Output ===
{"status":"success","amount_in":"500000","amount_out":"499000","tx_id":"0x7f8a9b..."}`,

  failed_execution: `=== Strategy Output ===
[INFO] Starting strategy execution...
[INFO] Checking wallet balance: 50000 µSTX
[ERROR] Insufficient balance for minimum swap amount
[ERROR] Required: 100000 µSTX, Available: 50000 µSTX
[ERROR] Strategy execution failed

=== Errors ===
Insufficient balance for swap operation`,

  timeout: `=== Strategy Output ===
[INFO] Starting strategy execution...
[INFO] Checking wallet balance: 1000000 µSTX
[INFO] Preparing swap transaction...
[WARN] Network response slow...
[WARN] Retrying transaction...
[ERROR] Request timeout

=== Errors ===
Execution timed out after 120 seconds`,

  successful_monitoring: `=== Strategy Output ===
[INFO] Starting strategy execution...
[INFO] Checking market conditions...
[INFO] Current USDA price: 1.002 STX
[INFO] Price above target range (0.995-1.000 STX)
[INFO] No action taken - waiting for better price
[INFO] Strategy completed successfully

=== Raw Output ===
{"status":"success","action":"monitor","reason":"price_too_high","target_range":"0.995-1.000"}`
};

export interface ExecutionGeneratorOptions {
  userId: string;
  botIds: string[];
  count: number;
  daysPast: number;
  profile: 'development' | 'testing' | 'demo' | 'production';
  generateBlobs?: boolean;
}

/**
 * Generate realistic execution records
 */
export async function generateExecutions(
  rng: SeededRandom,
  options: ExecutionGeneratorOptions
): Promise<BotExecution[]> {
  const executions: BotExecution[] = [];
  const startTime = Date.now();

  logger.info('Starting execution generation', {
    count: options.count,
    bots: options.botIds.length,
    daysPast: options.daysPast,
    profile: options.profile
  });

  for (let i = 0; i < options.count; i++) {
    const execution = await generateSingleExecution(rng, options, i);
    executions.push(execution);

    // Progress logging every 50 executions
    if ((i + 1) % 50 === 0) {
      logger.info(`Generated ${i + 1}/${options.count} executions`);
    }
  }

  const duration = Date.now() - startTime;
  logger.info('Execution generation complete', {
    count: executions.length,
    duration: `${duration}ms`,
    averageTime: `${Math.round(duration / executions.length)}ms per execution`
  });

  return executions;
}

/**
 * Generate a single realistic execution
 */
async function generateSingleExecution(
  rng: SeededRandom,
  options: ExecutionGeneratorOptions,
  index: number
): Promise<BotExecution> {
  // Select random bot
  const botId = rng.choice(options.botIds);
  
  // Select execution scenario based on weights
  const scenario = selectScenario(rng);
  
  // Generate execution timing
  const daysAgo = rng.nextFloat(0, options.daysPast);
  const executionTime = rng.nextInt(scenario.executionTimeRange[0], scenario.executionTimeRange[1]);
  const startedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const completedAt = new Date(startedAt.getTime() + executionTime);

  // Generate execution data
  const executionId = randomUUID();
  const status = rng.choice(scenario.statusOptions);
  const output = scenario.outputs ? rng.choice(scenario.outputs) : undefined;
  const error = scenario.errors ? rng.choice(scenario.errors) : undefined;
  const transactionId = scenario.hasTransaction && status === 'success' 
    ? generateTransactionId(rng) 
    : undefined;

  // Generate blob storage metadata if enabled
  let logsUrl: string | undefined;
  let logsSize: number | undefined;

  if (options.generateBlobs) {
    try {
      const logContent = generateLogContent(scenario.type, output, error);
      const logMetadata = await ExecutionLogService.store(
        options.userId,
        botId,
        executionId,
        logContent
      );
      logsUrl = logMetadata.url;
      logsSize = logMetadata.size;
    } catch (error) {
      // If blob storage fails (e.g., no token), simulate the metadata
      logger.warn('Blob storage failed, simulating metadata:', error);
      const logContent = generateLogContent(scenario.type, output, error);
      logsUrl = `https://blob.vercel-storage.com/executions/${options.userId}/${botId}/${executionId}.log`;
      logsSize = logContent.length;
    }
  }

  return {
    id: executionId,
    botId,
    startedAt: startedAt.toISOString(),
    completedAt: status === 'timeout' ? undefined : completedAt.toISOString(),
    status,
    output,
    error,
    transactionId,
    executionTime,
    sandboxId: `sbx_${randomUUID().slice(0, 8)}`,
    logsUrl,
    logsSize
  };
}

/**
 * Select execution scenario based on weights
 */
function selectScenario(rng: SeededRandom) {
  const random = rng.next();
  let cumulativeWeight = 0;

  for (const scenario of EXECUTION_SCENARIOS) {
    cumulativeWeight += scenario.weight;
    if (random <= cumulativeWeight) {
      return scenario;
    }
  }

  // Fallback to first scenario
  return EXECUTION_SCENARIOS[0];
}

/**
 * Generate realistic transaction ID
 */
function generateTransactionId(rng: SeededRandom): string {
  const prefix = '0x';
  const chars = '0123456789abcdef';
  let result = prefix;
  
  for (let i = 0; i < 64; i++) {
    result += chars[rng.nextInt(0, chars.length - 1)];
  }
  
  return result;
}

/**
 * Generate realistic log content for blob storage
 */
function generateLogContent(
  scenarioType: keyof typeof SAMPLE_LOG_CONTENT,
  output?: string,
  error?: string
): string {
  const baseContent = SAMPLE_LOG_CONTENT[scenarioType];
  const timestamp = new Date().toISOString();
  
  return `=== Execution Log ===
Execution ID: ${randomUUID()}
Timestamp: ${timestamp}

${baseContent}

=== Execution Summary ===
Status: ${scenarioType.replace('_', ' ')}
Output: ${output || 'N/A'}
Error: ${error || 'N/A'}
Generated: ${timestamp}`;
}