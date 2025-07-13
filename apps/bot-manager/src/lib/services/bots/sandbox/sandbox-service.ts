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
import { randomUUID } from "crypto";
import { config } from "dotenv";
import { resolve } from "path";

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

import { ExecutionLogService } from "../execution/execution-log-service";
import { strategyWrapperTemplate } from "./templates/strategy-wrapper";
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

      // Only allow HTTPS and HTTP protocols
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        return false;
      }

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
   * Store execution logs in blob storage and return metadata
   */
  private async storeExecutionLogs(
    userId: string,
    botId: string,
    executionId: string,
    logs: string[],
    allOutput: string,
    allError: string
  ): Promise<{ logsUrl?: string; logsSize?: number }> {
    try {
      // Combine all log data into a comprehensive log file
      const logLines = [
        `=== Execution Log for Bot ${botId} ===`,
        `Execution ID: ${executionId}`,
        `Timestamp: ${new Date().toISOString()}`,
        ``,
        `=== Strategy Output ===`,
        ...logs,
        ``
      ];

      // Add raw output if it differs from processed logs
      if (allOutput && allOutput.trim()) {
        logLines.push(`=== Raw Output ===`, allOutput.trim(), ``);
      }

      // Add errors if present
      if (allError && allError.trim()) {
        logLines.push(`=== Errors ===`, allError.trim(), ``);
      }

      const logContent = logLines.join('\n');

      // Store in blob storage
      const logMetadata = await ExecutionLogService.store(
        userId,
        botId,
        executionId,
        logContent
      );

      return {
        logsUrl: logMetadata.url,
        logsSize: logMetadata.size
      };
    } catch (error) {
      console.error('Failed to store execution logs:', error);
      // Don't fail the execution if log storage fails
      return {};
    }
  }

  /**
   * Execute a bot strategy with optional real-time callbacks
   * 
   * @param strategyCode - The strategy code to execute
   * @param bot - Bot instance or bot ID
   * @param options - Execution options
   * @param callbacks - Optional callbacks for real-time updates
   * @param userId - User ID for log storage (optional)
   * @param executionId - Execution ID for consistent tracking (optional)
   * @returns Promise<StrategyExecutionResult>
   */
  async executeStrategy(
    strategyCode: string,
    bot: Bot | string,
    options: StrategyExecutionOptions = {},
    callbacks?: ExecutionCallbacks,
    userId?: string,
    executionId?: string
  ): Promise<StrategyExecutionResult> {
    const startTime = Date.now();
    let sandbox: any = null;

    try {
      // Load bot if ID was provided
      const botInstance = await this.loadBot(bot);

      callbacks?.onStatus?.('Initializing sandbox...', new Date().toISOString());

      // Validate credentials
      if (!process.env.VERCEL_TOKEN || !process.env.VERCEL_TEAM_ID || !process.env.VERCEL_PROJECT_ID) {
        throw new Error('Missing required Vercel credentials');
      }

      // Build bot context
      const botContext = await this.buildBotContext(botInstance);

      callbacks?.onStatus?.(`Creating sandbox for ${botInstance.name}...`, new Date().toISOString());

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
      if (botInstance.gitRepository) {
        // Custom repository execution path
        callbacks?.onStatus?.("Using custom repository for execution...", new Date().toISOString());

        // Validate custom git repository
        if (!this.validateGitRepository(botInstance.gitRepository)) {
          throw new Error(`Invalid or unsupported git repository: ${botInstance.gitRepository}`);
        }

        // Validate and sanitize build configuration
        const isMonorepo = botInstance.isMonorepo || false;
        const packagePath = botInstance.packagePath ? this.sanitizePackagePath(botInstance.packagePath) : (isMonorepo ? "packages/polyglot" : "");
        const buildCommands = botInstance.buildCommands || ["pnpm install --frozen-lockfile", "pnpm run build"];

        // Validate build commands
        if (!this.validateBuildCommands(buildCommands)) {
          throw new Error('Invalid build commands detected. Only standard package managers and build tools are allowed.');
        }

        sandbox = await Sandbox.create({
          source: {
            url: botInstance.gitRepository,
            type: "git",
          },
          runtime: sandboxConfig.runtime,
          timeout: sandboxConfig.timeout,
          teamId: sandboxConfig.teamId,
          projectId: sandboxConfig.projectId,
          token: sandboxConfig.token,
        });

        callbacks?.onStatus?.(`Sandbox created from ${botInstance.gitRepository}: ${sandbox.sandboxId}`, new Date().toISOString());

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

          // Create minimal package.json at root for strategy dependencies
          // callbacks?.onStatus?.("Creating root package.json for strategy execution...", new Date().toISOString());

          // const rootPackageJson = {
          //   "name": "strategy-execution",
          //   "version": "1.0.0",
          //   "private": true
          // };

          // await sandbox.writeFiles([
          //   {
          //     path: "package.json",
          //     content: Buffer.from(JSON.stringify(rootPackageJson, null, 2), 'utf8')
          //   }
          // ]);

          // Install strategy dependencies at root level
          // callbacks?.onStatus?.("Installing strategy dependencies at root...", new Date().toISOString());

          // const rootInstallResult = await sandbox.runCommand({
          //   cmd: 'pnpm',
          //   args: ['add', '@stacks/transactions'],
          //   cwd: '/vercel/sandbox'
          // });

          // if (rootInstallResult.exitCode !== 0) {
          //   const stderr = typeof rootInstallResult.stderr === 'function' ? await rootInstallResult.stderr() : rootInstallResult.stderr;
          //   callbacks?.onStatus?.(`Warning: Failed to install root dependencies: ${stderr}`, new Date().toISOString());
          // } else {
          //   callbacks?.onStatus?.("Strategy dependencies installed at root", new Date().toISOString());
          // }
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
      const executionDir = (botInstance.gitRepository && botInstance.isMonorepo && botInstance.packagePath)
        ? botInstance.packagePath
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

      // Store logs in blob storage if userId is provided and we have logs
      let logMetadata: { logsUrl?: string; logsSize?: number } = {};
      if (userId && (logs.length > 0 || allOutput || allError)) {
        const logId = executionId || randomUUID();
        logMetadata = await this.storeExecutionLogs(
          userId,
          botInstance.id,
          logId,
          logs,
          allOutput,
          allError
        );
      }

      const executionResult: StrategyExecutionResult = {
        success,
        result: success ? { message: 'Strategy executed successfully' } : undefined,
        logs: options.enableLogs ? logs : undefined,
        error: executionError || allError,
        executionTime,
        sandboxId: sandbox.sandboxId,
        botContext,
        logsUrl: logMetadata.logsUrl,
        logsSize: logMetadata.logsSize
      };

      callbacks?.onResult?.(executionResult);

      return executionResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';

      await logger.error(`Strategy execution failed: ${errorMessage}`);

      // Store error logs if userId is provided
      let logMetadata: { logsUrl?: string; logsSize?: number } = {};
      if (userId) {
        const logId = executionId || randomUUID();
        const botInstance = await this.loadBot(bot);
        logMetadata = await this.storeExecutionLogs(
          userId,
          botInstance.id,
          logId,
          [`Execution failed: ${errorMessage}`],
          '',
          errorMessage
        );
      }

      const executionResult: StrategyExecutionResult = {
        success: false,
        error: errorMessage,
        executionTime,
        sandboxId: sandbox?.sandboxId,
        logsUrl: logMetadata.logsUrl,
        logsSize: logMetadata.logsSize
      };

      callbacks?.onResult?.(executionResult);

      return executionResult;

    } finally {
      // Clean up sandbox
      if (sandbox) {
        try {
          await sandbox.stop();
          callbacks?.onStatus?.('Sandbox cleaned up', new Date().toISOString());
        } catch {
          callbacks?.onLog?.('warn', 'Failed to cleanup sandbox', new Date().toISOString());
        }
      }
    }
  }

  /**
   * Load bot by ID or return bot instance
   * 
   * @param bot - Bot instance or bot ID
   * @returns Promise<Bot>
   */
  private async loadBot(bot: Bot | string): Promise<Bot> {
    if (typeof bot === 'object') {
      return bot;
    }

    const botId = bot;

    // Try API first if enabled
    if (process.env.NEXT_PUBLIC_ENABLE_API_BOTS === 'true') {
      try {
        const userId = process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
        const apiUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1'}/bots/${botId}?userId=${encodeURIComponent(userId)}`;
        const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${apiUrl}`);
        if (response.ok) {
          const apiBot = await response.json();
          return apiBot.bot || apiBot;
        }
      } catch (error) {
        console.warn(`Failed to load bot ${botId} from API, falling back to static data:`, error);
      }
    }

    // Fallback to static data
    const { botService } = await import('../core/service');
    const allBots = await botService.scanAllBots();
    const foundBot = allBots.find(b => b.id === botId);

    if (!foundBot) {
      throw new Error(`Bot with ID '${botId}' not found in API or static data`);
    }

    return foundBot;
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