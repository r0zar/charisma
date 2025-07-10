/**
 * Vercel Sandbox Service (Server-Side)
 * 
 * Server-side service for executing bot strategies in isolated Vercel Sandbox environments.
 * Provides secure sandbox creation and strategy execution with proper credential handling.
 * 
 * This file is intended for Node.js/server-side use only.
 */

// Replaced ms import with simple conversion function
import { Sandbox } from "@vercel/sandbox";
import { config } from "dotenv";
import { resolve } from "path";
// Note: No longer using parseStrategyCode - strategies are now raw JavaScript
import type { 
  SandboxConfig, 
  SandboxExecutionResult, 
  BotContext, 
  StrategyExecutionOptions, 
  StrategyExecutionResult 
} from "@/schemas/sandbox.schema";
import type { Bot } from "@/schemas/bot.schema";
// Dynamic import for wallet encryption to avoid env var requirement at module load

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

// Server-side logger (can use more sophisticated logging later)
const logger = {
  info: async (message: string) => console.log(`ℹ️ [SandboxService] ${message}`),
  success: async (message: string) => console.log(`✅ [SandboxService] ${message}`),
  error: async (message: string) => console.error(`❌ [SandboxService] ${message}`)
};

/**
 * Server-Side Vercel Sandbox Service
 * 
 * Handles secure execution of bot strategies in isolated Vercel Sandbox environments.
 * Only runs on server-side (Node.js) where Vercel credentials can be safely accessed.
 */
export class SandboxService {
  private defaultConfig: SandboxConfig;

  constructor(config?: Partial<SandboxConfig>) {
    this.defaultConfig = {
      runtime: 'node22',
      timeout: 2 * 60 * 1000, // 2 minutes in milliseconds
      teamId: process.env.VERCEL_TEAM_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
      token: process.env.VERCEL_TOKEN,
      ...config
    };
  }

  /**
   * Execute arbitrary JavaScript code in a sandbox
   * 
   * @param code - JavaScript code to execute
   * @param config - Optional sandbox configuration
   * @returns Execution result with output and metadata
   */
  async executeCode(code: string, config?: Partial<SandboxConfig>): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    let sandbox: any = null;

    try {
      await logger.info("Creating sandbox for code execution");

      // Validate credentials
      if (!this.defaultConfig.token || !this.defaultConfig.teamId || !this.defaultConfig.projectId) {
        throw new Error("Missing required Vercel credentials");
      }

      // Create sandbox with merged config
      const sandboxConfig = { ...this.defaultConfig, ...config };
      sandbox = await Sandbox.create({
        runtime: sandboxConfig.runtime,
        timeout: sandboxConfig.timeout,
        teamId: sandboxConfig.teamId,
        projectId: sandboxConfig.projectId,
        token: sandboxConfig.token,
      });

      await logger.success(`Sandbox created: ${sandbox.sandboxId}`);

      // Write code to sandbox
      await sandbox.writeFiles([
        {
          path: "script.js",
          content: Buffer.from(code, 'utf8')
        }
      ]);

      // Execute code and capture output
      let output = '';
      let error = '';

      const result = await sandbox.runCommand({
        cmd: "node",
        args: ["script.js"],
        stdout: 'pipe',
        stderr: 'pipe',
      });

      if (result.stdout) {
        output = result.stdout;
      }
      if (result.stderr) {
        error = result.stderr;
      }

      const executionTime = Date.now() - startTime;

      await logger.success(`Code execution completed in ${executionTime}ms`);

      return {
        success: result.exitCode === 0,
        output: output.trim(),
        error: error.trim() || undefined,
        exitCode: result.exitCode,
        executionTime,
        sandboxId: sandbox.sandboxId
      };

    } catch (err) {
      const executionTime = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Unknown execution error';
      
      await logger.error(`Sandbox execution failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        executionTime,
        sandboxId: sandbox?.sandboxId
      };

    } finally {
      // Clean up sandbox
      if (sandbox) {
        try {
          await sandbox.stop();
          await logger.info("Sandbox cleaned up successfully");
        } catch (cleanupError) {
          await logger.error("Failed to cleanup sandbox");
        }
      }
    }
  }

  /**
   * Execute a bot strategy with injected context
   * 
   * @param strategyCode - The strategy JavaScript code
   * @param bot - Bot instance to create context from  
   * @param options - Execution options
   * @returns Strategy execution result
   */
  async executeStrategy(
    strategyCode: string, 
    bot: Bot, 
    options: StrategyExecutionOptions = {}
  ): Promise<StrategyExecutionResult> {
    const startTime = Date.now();

    try {
      await logger.info(`Executing strategy for bot: ${bot.name}`);

      // Build bot context for injection
      const botContext = await this.buildBotContext(bot, options.testMode);

      // Create wrapper code that includes context and executes the raw strategy code
      const wrapperCode = this.createStrategyWrapper(strategyCode, botContext);

      // Execute in sandbox
      const executionResult = await this.executeCode(wrapperCode, {
        timeout: options.timeout ? options.timeout * 60 * 1000 : undefined // Convert minutes to milliseconds
      });

      // Parse execution result - much simpler now
      let logs: string[] = [];
      let executionComplete = false;
      let executionError: string | undefined;

      if (executionResult.output) {
        const lines = executionResult.output.split('\n').filter(line => line.trim());
        
        // Filter out our execution markers and extract logs
        logs = lines.filter(line => 
          !line.startsWith('STRATEGY_EXECUTION_COMPLETE') && 
          !line.startsWith('STRATEGY_EXECUTION_ERROR:')
        );
        
        // Check for completion markers
        executionComplete = lines.some(line => line.startsWith('STRATEGY_EXECUTION_COMPLETE'));
        const errorLine = lines.find(line => line.startsWith('STRATEGY_EXECUTION_ERROR:'));
        if (errorLine) {
          executionError = errorLine.replace('STRATEGY_EXECUTION_ERROR:', '');
        }
      }

      // Determine success based on exit code and execution markers
      const success = executionResult.success && (executionComplete || !executionError);

      return {
        success,
        result: success ? { message: 'Strategy executed successfully' } : undefined,
        logs: options.enableLogs ? logs : undefined,
        error: executionError || executionResult.error,
        executionTime: Date.now() - startTime,
        sandboxId: executionResult.sandboxId,
        botContext: options.testMode ? botContext : undefined
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown strategy execution error';
      await logger.error(`Strategy execution failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Build bot context object for strategy injection
   * 
   * @param bot - Bot instance
   * @param testMode - Whether to use test/mock operations
   * @returns Bot context object
   */
  async buildBotContext(bot: Bot, testMode: boolean = true): Promise<BotContext> {
    // Build unified balance object from bot data
    const balance: { [token: string]: number } = {
      STX: 0 // Balance data moved to analytics system
    };

    // Balance data has been moved to analytics system
    // LP and reward token balances are no longer stored on bot objects

    // Get wallet credentials for real mode execution
    let walletCredentials: { privateKey?: string } = {};
    if (!testMode) {
      try {
        const { getPrivateKeyForExecution } = await import("@/lib/infrastructure/security/wallet-encryption");
        const privateKey = getPrivateKeyForExecution(bot);
        if (privateKey) {
          walletCredentials.privateKey = privateKey;
          await logger.info(`Bot ${bot.id} wallet credentials loaded for real execution`);
        } else {
          await logger.error(`Bot ${bot.id} missing wallet credentials for real execution`);
        }
      } catch (error) {
        await logger.error(`Failed to load wallet encryption module: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Create bot context with methods
    const context: BotContext = {
      id: bot.id,
      name: bot.name,
      status: bot.status,
      wallet_address: bot.id, // Bot ID is now the wallet address
      created_at: bot.createdAt,
      last_active: bot.lastActive,
      balance,
      testMode, // Include test mode flag for wrapper code
      walletCredentials: !testMode ? walletCredentials : undefined,

      // Trading methods - mock implementations for MVP, real for scheduled execution
      async swap(fromToken: string, toToken: string, amount: number, slippage: number = 0.5) {
        if (testMode) {
          // Mock successful swap
          const mockAmountReceived = amount * 0.99; // Simulate 1% slippage
          return {
            success: true,
            txid: `mock-swap-${Date.now()}`,
            amountReceived: mockAmountReceived
          };
        }
        
        // Real trading implementation for scheduled execution
        console.log(`[SandboxService] Real swap requested: ${amount} ${fromToken} -> ${toToken} (slippage: ${slippage}%)`);
        
        // For now, return a mock response even in real mode
        // TODO: Implement real DEX integration when Phase 4 is ready
        return {
          success: true,
          txid: `scheduled-swap-${Date.now()}`,
          amountReceived: amount * (1 - slippage / 100),
          note: "Real trading not yet implemented - this is a placeholder"
        };
      },

      async addLiquidity(token1: string, token2: string, amount1: number, amount2: number, slippage: number = 0.5) {
        if (testMode) {
          // Mock successful liquidity addition
          const mockLpTokens = Math.sqrt(amount1 * amount2);
          return {
            success: true,
            txid: `mock-add-liquidity-${Date.now()}`,
            lpTokensReceived: mockLpTokens
          };
        }
        // TODO: Implement real liquidity addition
        throw new Error("Live trading not yet implemented");
      },

      async removeLiquidity(lpToken: string, amount: number, slippage: number = 0.5) {
        if (testMode) {
          // Mock successful liquidity removal
          return {
            success: true,
            txid: `mock-remove-liquidity-${Date.now()}`,
            tokensReceived: { STX: amount * 0.5, USDA: amount * 0.5 }
          };
        }
        // TODO: Implement real liquidity removal
        throw new Error("Live trading not yet implemented");
      },

      async claimRewards(contractId: string) {
        if (testMode) {
          // Mock successful reward claim
          return {
            success: true,
            txid: `mock-claim-${Date.now()}`,
            amountClaimed: Math.random() * 1000000 // Random reward amount
          };
        }
        // TODO: Implement real reward claiming
        throw new Error("Live trading not yet implemented");
      },

      async stake(contractId: string, amount: number) {
        if (testMode) {
          return {
            success: true,
            txid: `mock-stake-${Date.now()}`
          };
        }
        // TODO: Implement real staking
        throw new Error("Live trading not yet implemented");
      },

      async unstake(contractId: string, amount: number) {
        if (testMode) {
          return {
            success: true,
            txid: `mock-unstake-${Date.now()}`
          };
        }
        // TODO: Implement real unstaking
        throw new Error("Live trading not yet implemented");
      }
    };

    return context;
  }

  /**
   * Create wrapper code that injects bot as global variable and executes raw strategy code
   * 
   * @param strategyCode - Original strategy code (raw JavaScript)
   * @param botContext - Bot context to inject as global
   * @returns Wrapped code ready for execution
   */
  createStrategyWrapper(strategyCode: string, botContext: BotContext): string {
    // TODO: Add more sophisticated code injection and security validation
    // TODO: Add import restrictions and API allowlisting
    // TODO: Add execution time limits and resource monitoring

    // Debug logging to verify bot context
    console.log(`[SandboxService] Creating strategy wrapper for bot: ${botContext.name || 'unknown'}`);
    console.log(`[SandboxService] Bot context keys: ${Object.keys(botContext).join(', ')}`);
    
    const isTestMode = botContext.testMode !== false;
    
    // Choose appropriate function implementations based on test mode
    const swapImplementation = isTestMode ? `
  // Mock implementation for testing
  const mockAmountReceived = amount * 0.99;
  return {
    success: true,
    txid: \`mock-swap-\${Date.now()}\`,
    amountReceived: mockAmountReceived
  };` : `
  // Real trading implementation for scheduled execution
  console.log(\`[Bot] Real swap requested: \${amount} \${fromToken} -> \${toToken} (slippage: \${slippage}%)\`);
  
  // For now, return a mock response even in real mode
  // TODO: Implement real DEX integration when Phase 4 is ready
  return {
    success: true,
    txid: \`scheduled-swap-\${Date.now()}\`,
    amountReceived: amount * (1 - slippage / 100),
    note: "Real trading not yet implemented - this is a placeholder"
  };`;

    const addLiquidityImplementation = isTestMode ? `
  const mockLpTokens = Math.sqrt(amount1 * amount2);
  return {
    success: true,
    txid: \`mock-add-liquidity-\${Date.now()}\`,
    lpTokensReceived: mockLpTokens
  };` : `
  // TODO: Implement real liquidity addition
  throw new Error("Live trading not yet implemented");`;

    const removeLiquidityImplementation = isTestMode ? `
  return {
    success: true,
    txid: \`mock-remove-liquidity-\${Date.now()}\`,
    tokensReceived: { STX: amount * 0.5, USDA: amount * 0.5 }
  };` : `
  // TODO: Implement real liquidity removal
  throw new Error("Live trading not yet implemented");`;

    const claimRewardsImplementation = isTestMode ? `
  return {
    success: true,
    txid: \`mock-claim-\${Date.now()}\`,
    amountClaimed: Math.random() * 1000000
  };` : `
  // TODO: Implement real reward claiming
  throw new Error("Live trading not yet implemented");`;

    const stakeImplementation = isTestMode ? `
  return {
    success: true,
    txid: \`mock-stake-\${Date.now()}\`
  };` : `
  // TODO: Implement real staking
  throw new Error("Live trading not yet implemented");`;

    const unstakeImplementation = isTestMode ? `
  return {
    success: true,
    txid: \`mock-unstake-\${Date.now()}\`
  };` : `
  // TODO: Implement real unstaking
  throw new Error("Live trading not yet implemented");`;

    // Serialize bot context for injection
    const serializedBot = JSON.stringify(botContext, null, 2);
    console.log(`[SandboxService] Serialized bot context (first 200 chars): ${serializedBot.substring(0, 200)}...`);
    
    return `
// Injected bot context as global variable
const bot = ${serializedBot};

// Debug logging for bot injection
console.log('🔍 [Debug] Bot object created:', typeof bot);
console.log('🔍 [Debug] Bot name:', bot ? bot.name : 'undefined');
console.log('🔍 [Debug] Bot keys:', bot ? Object.keys(bot).join(', ') : 'no keys');

// Safety check and restore function methods (JSON.stringify removes functions)
if (!bot) {
  console.error('❌ [Error] Bot object is null or undefined after injection!');
  throw new Error('Bot context failed to inject properly');
}

bot.swap = async function(fromToken, toToken, amount, slippage = 0.5) {${swapImplementation}
};

bot.addLiquidity = async function(token1, token2, amount1, amount2, slippage = 0.5) {${addLiquidityImplementation}
};

bot.removeLiquidity = async function(lpToken, amount, slippage = 0.5) {${removeLiquidityImplementation}
};

bot.claimRewards = async function(contractId) {${claimRewardsImplementation}
};

bot.stake = async function(contractId, amount) {${stakeImplementation}
};

bot.unstake = async function(contractId, amount) {${unstakeImplementation}
};

// Execute raw strategy code directly (no function wrapper needed)
(async function() {
  try {
    ${strategyCode}
    
    // Strategy execution completed successfully
    console.log('STRATEGY_EXECUTION_COMPLETE');
    
  } catch (error) {
    console.error('Strategy execution error:', error.message);
    console.log('STRATEGY_EXECUTION_ERROR:' + error.message);
  }
})();
`;
  }
}

// Create default singleton instance for server-side use
export const sandboxService = new SandboxService();

// TODO: Wishlist features for future development:
// TODO: Advanced security validation and code sanitization
// TODO: Execution history and audit trails  
// TODO: Performance monitoring and metrics collection
// TODO: Multiple runtime support (Python, etc.)
// TODO: Concurrent execution management and queuing
// TODO: Advanced error recovery and retry logic
// TODO: Integration with existing bot scheduling system
// TODO: Real-time execution logs streaming via WebSocket
// TODO: Resource usage monitoring and limits enforcement
// TODO: Production-ready security hardening and penetration testing
// TODO: Custom npm package injection for strategies
// TODO: Strategy version control and rollback capabilities
// TODO: A/B testing framework for strategy comparison
// TODO: Machine learning integration for strategy optimization
// TODO: Real-time market data injection and API rate limiting
// TODO: Multi-chain trading support and cross-chain operations
// TODO: Advanced portfolio management and risk assessment
// TODO: Compliance reporting and regulatory audit trails
// TODO: Integration with external trading APIs and data providers
// TODO: Strategy marketplace and sharing platform