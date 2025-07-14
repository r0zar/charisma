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

// Note: dataLoader removed - using specific services instead
import type { Bot } from "@/schemas/bot.schema";
// Note: No longer using parseStrategyCode - strategies are now raw JavaScript
import type {
  BotContext,
  ExecutionCallbacks,
  SandboxConfig,
  StrategyExecutionOptions,
  StrategyExecutionResult
} from "@/schemas/sandbox.schema";

import { strategyWrapperTemplate } from "./templates/strategy-wrapper";

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
      timeout: 30 * 1000, // 30 seconds in milliseconds
      teamId: process.env.VERCEL_TEAM_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
      token: process.env.VERCEL_TOKEN,
      ...config
    };
  }



  /**
   * Build bot context object for strategy injection
   * 
   * @param bot - Bot instance
   * @returns Bot context object
   */
  async buildBotContext(bot: Bot): Promise<BotContext> {
    // Get wallet credentials for execution
    const walletCredentials: { privateKey?: string } = {};
    try {
      const { getPrivateKeyForExecution } = await import("@/lib/modules/security/wallet-encryption");
      const privateKey = getPrivateKeyForExecution(bot);
      if (privateKey) {
        walletCredentials.privateKey = privateKey;
        await logger.info(`Bot ${bot.id} wallet credentials loaded for execution`);
      } else {
        await logger.error(`Bot ${bot.id} missing wallet credentials for execution`);
      }
    } catch (error) {
      await logger.error(`Failed to load wallet encryption module: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Create bot context - minimal context for real implementations
    const context: BotContext = {
      id: bot.id,
      name: bot.name,
      status: bot.status,
      created_at: bot.createdAt,
      last_active: bot.lastActive,
      ownerId: bot.ownerId,
      walletCredentials
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
    // Debug logging to verify bot context
    console.log(`[SandboxService] Creating strategy wrapper for bot: ${botContext.name || 'unknown'}`);
    console.log(`[SandboxService] Bot context keys: ${Object.keys(botContext).join(', ')}`);

    try {
      // Serialize bot context for injection
      const serializedBot = JSON.stringify(botContext, null, 2);
      console.log(`[SandboxService] Serialized bot context (first 200 chars): ${serializedBot.substring(0, 200)}...`);

      // Generate minimal strategy wrapper
      return strategyWrapperTemplate({
        botContext: serializedBot,
        strategyCode
      });

    } catch (error) {
      console.error('[SandboxService] Template generation failed:', error);
      throw new Error(`Failed to create strategy wrapper: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate git repository URL for security
   */
  private validateGitRepository(url: string): boolean {
    try {
      const parsed = new URL(url);

      // Only allow specific git hosting platforms for security
      const allowedHosts = [
        'github.com',
        'gitlab.com',
        'bitbucket.org',
        'git.sr.ht',
        'codeberg.org'
      ];

      return allowedHosts.includes(parsed.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  /**
   * Validate build commands for security
   */
  private validateBuildCommands(commands: string[]): boolean {
    const allowedCommands = [
      'npm', 'yarn', 'pnpm', 'bun',
      'node', 'deno',
      'make', 'cmake',
      'cargo', 'go',
      'python', 'pip',
      'composer'
    ];

    for (const command of commands) {
      const [cmd] = command.trim().split(' ');
      if (!allowedCommands.includes(cmd)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Sanitize package path to prevent directory traversal
   */
  private sanitizePackagePath(path: string): string {
    // Remove any path traversal attempts
    return path.replace(/\.\./g, '').replace(/^\/+/, '').trim();
  }

  /**
   * Execute a bot strategy with optional real-time callbacks
   * 
   * @param strategyCode - The strategy code to execute
   * @param bot - Bot instance or bot ID
   * @param options - Execution options
   * @param callbacks - Optional callbacks for real-time updates
   * @returns Promise<StrategyExecutionResult>
   */
  async executeStrategy(
    strategyCode: string,
    bot: Bot,
    options: StrategyExecutionOptions = {},
    callbacks?: ExecutionCallbacks
  ): Promise<StrategyExecutionResult> {
    const startTime = Date.now();
    let sandbox: any = null;

    try {
      callbacks?.onStatus?.('Initializing sandbox...', new Date().toISOString());

      // Validate credentials
      if (!process.env.VERCEL_TOKEN || !process.env.VERCEL_TEAM_ID || !process.env.VERCEL_PROJECT_ID) {
        throw new Error('Missing required Vercel credentials');
      }

      // Build bot context
      const botContext = await this.buildBotContext(bot);

      callbacks?.onStatus?.(`Creating sandbox for ${bot.name}...`, new Date().toISOString());

      // Create wrapper code
      const wrapperCode = this.createStrategyWrapper(strategyCode, botContext);

      const sandboxConfig = {
        runtime: 'node22' as const,
        timeout: (options.timeout || 2) * 60 * 1000,
        teamId: process.env.VERCEL_TEAM_ID,
        projectId: process.env.VERCEL_PROJECT_ID,
        token: process.env.VERCEL_TOKEN
      };

      // Check if custom repository is specified
      if (bot.gitRepository) {
        // Custom repository execution path
        callbacks?.onStatus?.("Using custom repository for execution...", new Date().toISOString());

        // Validate custom git repository
        if (!this.validateGitRepository(bot.gitRepository)) {
          throw new Error(`Invalid or unsupported git repository: ${bot.gitRepository}`);
        }

        // Validate and sanitize build configuration
        const isMonorepo = bot.isMonorepo || false;
        const packagePath = bot.packagePath ? this.sanitizePackagePath(bot.packagePath) : (isMonorepo ? "packages/polyglot" : "");
        const buildCommands = bot.buildCommands || ["pnpm install --frozen-lockfile", "pnpm run build"];

        // Validate build commands
        if (!this.validateBuildCommands(buildCommands)) {
          throw new Error('Invalid build commands detected. Only standard package managers and build tools are allowed.');
        }

        sandbox = await Sandbox.create({
          source: {
            url: bot.gitRepository,
            type: "git",
          },
          runtime: sandboxConfig.runtime,
          timeout: sandboxConfig.timeout,
          teamId: sandboxConfig.teamId,
          projectId: sandboxConfig.projectId,
          token: sandboxConfig.token,
        });

        callbacks?.onStatus?.(`Sandbox created from ${bot.gitRepository}: ${sandbox.sandboxId}`, new Date().toISOString());

        if (isMonorepo && packagePath) {
          // Monorepo: install and build specific package
          const fullPath = `/vercel/sandbox/${packagePath}`;
          callbacks?.onStatus?.(`Installing dependencies for ${packagePath}...`, new Date().toISOString());

          for (const command of buildCommands) {
            const [cmd, ...args] = command.split(' ');
            callbacks?.onStatus?.(`Running: ${command}`, new Date().toISOString());

            const result = await sandbox.runCommand({
              cmd,
              args,
              cwd: fullPath,
              timeout: 300000 // 5 minute timeout per command
            });

            if (result.exitCode !== 0) {
              const stderr = typeof result.stderr === 'function' ? await result.stderr() : result.stderr;
              throw new Error(`Command "${command}" failed in ${packagePath}: ${stderr}`);
            }
          }

          callbacks?.onStatus?.(`Package ${packagePath} built successfully`, new Date().toISOString());
        } else {
          // Standalone repo: install and build at root
          callbacks?.onStatus?.("Installing dependencies at repository root...", new Date().toISOString());

          for (const command of buildCommands) {
            const [cmd, ...args] = command.split(' ');
            callbacks?.onStatus?.(`Running: ${command}`, new Date().toISOString());

            const result = await sandbox.runCommand({
              cmd,
              args,
              cwd: "/vercel/sandbox"
            });

            if (result.exitCode !== 0) {
              const stderr = typeof result.stderr === 'function' ? await result.stderr() : result.stderr;
              throw new Error(`Command "${command}" failed: ${stderr}`);
            }
          }

          callbacks?.onStatus?.("Repository built successfully", new Date().toISOString());
        }
      } else {
        // Direct Node.js execution (no repository)
        callbacks?.onStatus?.("Creating clean Node.js sandbox...", new Date().toISOString());

        sandbox = await Sandbox.create({
          runtime: sandboxConfig.runtime,
          timeout: sandboxConfig.timeout,
          teamId: sandboxConfig.teamId,
          projectId: sandboxConfig.projectId,
          token: sandboxConfig.token,
        });

        callbacks?.onStatus?.(`Clean Node.js sandbox created: ${sandbox.sandboxId}`, new Date().toISOString());
      }

      // Determine execution directory and write strategy code
      const executionDir = (bot.gitRepository && bot.isMonorepo && bot.packagePath)
        ? bot.packagePath
        : "";

      const strategyPath = executionDir ? `${executionDir}/strategy.cjs` : "strategy.cjs";
      const executionCwd = executionDir ? `/vercel/sandbox/${executionDir}` : '/vercel/sandbox';

      // Write strategy code to appropriate directory
      await sandbox.writeFiles([
        {
          path: strategyPath,
          content: Buffer.from(wrapperCode, 'utf8')
        }
      ]);

      callbacks?.onStatus?.("Ready to execute strategy...", new Date().toISOString());

      // Execute strategy
      let allOutput = '';
      let allError = '';

      const cmd = await sandbox.runCommand({
        cmd: 'node',
        args: ['strategy.cjs'],
        cwd: executionCwd,
        detached: true,
      });

      // Stream logs if enabled
      if (options.enableLogs && callbacks?.onLog) {
        for await (const log of cmd.logs()) {
          const logData = log.data.toString();

          if (log.stream === "stdout") {
            allOutput += logData;
            const lines = logData.split('\n').filter((line: string) => line.trim());
            for (const line of lines) {
              // Stream all stdout lines as info logs
              callbacks.onLog('info', line, new Date().toISOString());
            }
          } else if (log.stream === "stderr") {
            allError += logData;
            const lines = logData.split('\n').filter((line: string) => line.trim());
            for (const line of lines) {
              // Stream all stderr lines as error logs
              callbacks.onLog('error', line, new Date().toISOString());
            }
          }
        }
      } else {
        // Still collect output without streaming
        for await (const log of cmd.logs()) {
          if (log.stream === "stdout") {
            allOutput += log.data.toString();
          } else if (log.stream === "stderr") {
            allError += log.data.toString();
          }
        }
      }

      // Get final result
      const result = await cmd;

      // Parse execution result
      let logs: string[] = [];
      let executionError: string | undefined;

      if (allOutput) {
        const lines = allOutput.split('\n').filter(line => line.trim());

        // Check for explicit error markers
        const errorLine = lines.find(line => line.startsWith('STRATEGY_EXECUTION_ERROR:'));
        if (errorLine) {
          executionError = errorLine.replace('STRATEGY_EXECUTION_ERROR:', '').trim();
        }

        // Include all output lines as logs (excluding error markers)
        logs = lines.filter(line => !line.startsWith('STRATEGY_EXECUTION_ERROR:'));
      }

      // Check if strategy completed successfully by looking for completion marker
      const hasCompletionMarker = allOutput.includes('STRATEGY_EXECUTION_COMPLETE');

      // Success is determined by exit code 0 (or undefined if not provided) and either completion marker or no errors
      const exitCodeSuccess = result.exitCode === 0 || result.exitCode === undefined;
      const success = exitCodeSuccess && (hasCompletionMarker || (!executionError && !allError.trim()));
      const executionTime = Date.now() - startTime;

      callbacks?.onStatus?.(`Execution completed - Success: ${success}`, new Date().toISOString());

      const executionResult: StrategyExecutionResult = {
        success,
        result: success ? { message: 'Strategy executed successfully' } : undefined,
        logs: options.enableLogs ? logs : undefined,
        error: executionError || allError,
        executionTime,
        sandboxId: sandbox.sandboxId,
        botContext
      };

      callbacks?.onResult?.(executionResult);

      return executionResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';

      await logger.error(`Strategy execution failed: ${errorMessage}`);

      const executionResult: StrategyExecutionResult = {
        success: false,
        error: errorMessage,
        executionTime,
        sandboxId: sandbox?.sandboxId
      };

      callbacks?.onResult?.(executionResult);

      return executionResult;

    } finally {
      // Clean up sandbox
      if (sandbox) {
        try {
          await sandbox.stop();
          callbacks?.onStatus?.('Sandbox cleaned up', new Date().toISOString());
        } catch (cleanupError) {
          callbacks?.onLog?.('warn', 'Failed to cleanup sandbox', new Date().toISOString());
        }
      }
    }
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