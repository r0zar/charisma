/**
 * BotService - Streamlined controller for bot backend operations
 * Provides smart CRUD methods with built-in auth validation and state management
 */

import { auth } from '@clerk/nextjs/server';
import { kv } from '@vercel/kv';
import { z } from 'zod';

import { executionDataStore } from '@/lib/modules/storage/kv-stores/execution-store';
import { ENABLE_API_BOTS } from '@/lib/utils/config';
import {
  Bot,
  BotSchema,
  CreateBotRequest,
  CreateBotRequestSchema
} from '@/schemas/bot.schema';

import { BotStateMachine } from './bot-state-machine';


export class BotService {
  public readonly useKV: boolean;
  private readonly botKeyPrefix = 'bot-manager:bots';
  private readonly userBotIndexPrefix = 'bot-manager:user-index';
  private adminContext: { userId: string } | null = null;

  constructor() {
    this.useKV = ENABLE_API_BOTS;
  }

  /**
   * Set admin context for machine-to-machine operations
   * This bypasses Clerk authentication for scripts and admin operations
   */
  public setAdminContext(userId: string): void {
    this.adminContext = { userId };
  }

  /**
   * Clear admin context to return to normal Clerk auth
   */
  public clearAdminContext(): void {
    this.adminContext = null;
  }

  /**
   * Get current user ID from admin context or Clerk auth
   */
  private async getCurrentUserId(): Promise<string | null> {
    // Check admin context first (for scripts and machine-to-machine operations)
    if (this.adminContext) {
      return this.adminContext.userId;
    }

    // Fall back to Clerk authentication
    try {
      const { userId } = await auth();
      return userId;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate if current user owns a bot
   */
  private async validateBotOwnership(botId: string): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    if (!userId) return false;

    // Skip ownership validation for admin context (system operations)
    if (this.adminContext) {
      return true; // Admin context has access to all bots
    }

    try {
      const userBots = await kv.smembers(`${this.userBotIndexPrefix}:${userId}:owned-bots`) || [];
      return userBots.includes(botId);
    } catch (error) {
      return false;
    }
  }

  // ==================== STREAMLINED CRUD OPERATIONS ====================

  /**
   * Smart function to get any bot by ID with comprehensive execution data
   * Uses Clerk auth to validate ownership for private bots
   */
  async getBot(botId: string, options: {
    includeExecutions?: boolean;
    executionLimit?: number
  } = {}): Promise<Bot | null> {
    if (!this.useKV) {
      return null;
    }

    const { includeExecutions = true, executionLimit = 50 } = options;

    try {
      // Get the bot with single KV lookup
      const rawBot = await kv.get<Bot>(`${this.botKeyPrefix}:${botId}`);
      if (!rawBot) {
        return null;
      }

      // Validate the bot data from storage using source of truth schema
      const bot = BotSchema.parse(rawBot);

      // For owned bots, validate ownership via Clerk auth
      const isOwned = await this.validateBotOwnership(botId);

      // Return bot if public or owned (for now, all bots are public-readable)
      if (!isOwned && !bot) {
        return bot; // This handles future privacy logic
      }

      // If execution data is not requested, return basic bot
      if (!includeExecutions) {
        return bot;
      }

      // For security, only load execution data if user owns the bot or admin
      const userId = await this.getCurrentUserId();
      if (!userId || !isOwned) {
        // Return bot without execution data for non-owners
        return bot;
      }

      // Add execution data for authenticated owned bots
      try {
        // Get execution history
        const executions = await executionDataStore.getExecutions(botId, executionLimit);

        // Calculate execution statistics
        const totalExecutions = executions.length;
        const successfulExecutions = executions.filter(e => e.status === 'success').length;
        const failedExecutions = executions.filter(e => e.status === 'failure').length;

        // Calculate average execution time
        const completedExecutions = executions.filter(e => e.completedAt && e.executionTime);
        const averageExecutionTime = completedExecutions.length > 0
          ? completedExecutions.reduce((sum, e) => sum + (e.executionTime || 0), 0) / completedExecutions.length
          : undefined;

        // Find last successful and failed executions
        const lastSuccessfulExecution = executions
          .find(e => e.status === 'success')?.completedAt;
        const lastFailedExecution = executions
          .find(e => e.status === 'failure')?.completedAt;

        // Get recent logs from the most recent execution
        const recentExecution = executions[0];
        const recentLogs = recentExecution?.logsUrl ? {
          url: recentExecution.logsUrl,
          size: recentExecution.logsSize || 0,
          timestamp: recentExecution.startedAt
        } : undefined;

        // Determine scheduling context
        const now = new Date();
        const nextExecution = bot.nextExecution ? new Date(bot.nextExecution) : null;
        const isOverdue = nextExecution ? now > nextExecution : false;

        const nextExecutionDescription = nextExecution
          ? `Scheduled for ${nextExecution.toLocaleString()}`
          : bot.cronSchedule
            ? 'Schedule configured but no next execution set'
            : 'Manual execution only';

        // Validate execution readiness
        const canExecute = bot.status === 'active';
        const validationErrors: string[] = [];

        if (!canExecute) {
          validationErrors.push(`Bot status '${bot.status}' does not allow execution`);
        }
        if (!bot.strategy || bot.strategy.trim().length === 0) {
          validationErrors.push('Bot strategy is empty');
        }

        const enhancedBot: Bot = {
          ...bot,
          // Enhanced execution data
          executions,
          executionStats: {
            totalExecutions,
            successfulExecutions,
            failedExecutions,
            averageExecutionTime,
            lastSuccessfulExecution,
            lastFailedExecution
          },
          recentLogs,
          schedulingInfo: {
            isOverdue,
            nextExecutionDescription,
            canExecute,
            validationErrors: validationErrors.length > 0 ? validationErrors : undefined
          }
        };

        // Validate the enhanced bot data using the schema
        return BotSchema.parse(enhancedBot);
      } catch (executionError) {
        console.warn('Failed to load execution data for bot, returning basic bot:', executionError);
        return bot; // Return basic bot if execution data fails
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Bot data validation failed for bot ${botId}: ${error.issues.map(i => i.message).join(', ')}`);
      }
      console.error('Failed to get bot:', error);
      return null;
    }
  }

  /**
   * Smart function to list bots with intelligent filtering and optional state machine data
   * Uses Clerk auth to automatically determine user context
   */
  async listBots(options: {
    ownerId?: string;
    status?: string;
    limit?: number;
    includeStateInfo?: boolean;
    includeExecutions?: boolean;
    executionLimit?: number;
  } = {}): Promise<Bot[]> {
    if (!this.useKV) {
      return [];
    }

    try {
      const {
        ownerId,
        status,
        limit,
        includeStateInfo = false,
        includeExecutions = false,
        executionLimit = 10
      } = options;

      const rawBots: Bot[] = [];

      if (ownerId) {
        // Get bots for a specific owner
        const userBotIds = await kv.smembers(`${this.userBotIndexPrefix}:${ownerId}:owned-bots`) || [];
        for (const botId of userBotIds) {
          const bot = await kv.get<Bot>(`${this.botKeyPrefix}:${botId}`);
          if (bot) rawBots.push(bot);
        }
      } else {
        // Get ALL bots (system/admin context)
        const keys = await kv.keys(`${this.botKeyPrefix}:*`);
        for (const key of keys) {
          // Skip index keys - they contain sets of bot IDs, not bot data
          if (key.includes(':index') || key.includes(':owned-bots')) {
            continue;
          }

          try {
            const bot = await kv.get<Bot>(key);
            if (bot) rawBots.push(bot);
          } catch (error) {
            console.warn(`Failed to get bot data for key ${key}:`, error);
            // Skip this key and continue
          }
        }
      }

      // Validate all bot data from storage using source of truth schema
      let bots = rawBots
        .map(rawBot => {
          try {
            return BotSchema.parse(rawBot);
          } catch (error) {
            // Log the error for debugging but throw to surface data corruption issues
            console.error('Invalid bot data in storage - this indicates data corruption:', {
              botId: rawBot?.id || 'unknown',
              botData: rawBot,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw new Error(`Bot data validation failed for bot ${rawBot?.id || 'unknown'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        });

      // Filter by status if specified
      if (status && status !== 'all') {
        bots = bots.filter(bot => bot.status === status);
      }

      // Sort by createdAt (newest first)
      bots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply limit if specified
      if (limit) {
        bots = bots.slice(0, limit);
      }

      // Enhance bots with state machine info if requested
      if (includeStateInfo) {
        bots = bots.map(bot => {
          try {
            const availableActions = BotStateMachine.getAvailableActions(bot);
            const recommendedActions = BotStateMachine.getRecommendedActions(bot);
            const statusDescription = BotStateMachine.getStatusDescription(bot.status);

            return {
              ...bot,
              availableActions,
              recommendedActions,
              statusDescription,
              canStart: BotStateMachine.isActionAvailable(bot, 'start'),
              canPause: BotStateMachine.isActionAvailable(bot, 'pause'),
              canStop: BotStateMachine.isActionAvailable(bot, 'stop'),
              canReset: BotStateMachine.isActionAvailable(bot, 'reset'),
              canReactivate: BotStateMachine.isActionAvailable(bot, 'reactivate')
            };
          } catch (error) {
            console.warn('Failed to add state info for bot:', bot.id, error);
            return bot;
          }
        });
      }

      // Enhance bots with execution data if requested
      if (includeExecutions) {
        const enhancedBots = await Promise.all(
          bots.map(async (bot) => {
            try {
              // Get execution history
              const executions = await executionDataStore.getExecutions(bot.id, executionLimit);

              // Calculate execution statistics
              const totalExecutions = executions.length;
              const successfulExecutions = executions.filter(e => e.status === 'success').length;
              const failedExecutions = executions.filter(e => e.status === 'failure').length;

              // Calculate average execution time
              const completedExecutions = executions.filter(e => e.completedAt && e.executionTime);
              const averageExecutionTime = completedExecutions.length > 0
                ? completedExecutions.reduce((sum, e) => sum + (e.executionTime || 0), 0) / completedExecutions.length
                : undefined;

              // Find last successful and failed executions
              const lastSuccessfulExecution = executions
                .find(e => e.status === 'success')?.completedAt;
              const lastFailedExecution = executions
                .find(e => e.status === 'failure')?.completedAt;

              // Get recent logs from the most recent execution
              const recentExecution = executions[0];
              const recentLogs = recentExecution?.logsUrl ? {
                url: recentExecution.logsUrl,
                size: recentExecution.logsSize || 0,
                timestamp: recentExecution.startedAt
              } : undefined;

              // Determine scheduling context
              const now = new Date();
              const nextExecution = bot.nextExecution ? new Date(bot.nextExecution) : null;
              const isOverdue = nextExecution ? now > nextExecution : false;

              const nextExecutionDescription = nextExecution
                ? `Scheduled for ${nextExecution.toLocaleString()}`
                : bot.cronSchedule
                  ? 'Schedule configured but no next execution set'
                  : 'Manual execution only';

              // Validate execution readiness
              const canExecute = bot.status === 'active';
              const validationErrors: string[] = [];

              if (!canExecute) {
                validationErrors.push(`Bot status '${bot.status}' does not allow execution`);
              }
              if (!bot.strategy || bot.strategy.trim().length === 0) {
                validationErrors.push('Bot strategy is empty');
              }

              return {
                ...bot,
                // Enhanced execution data
                executions,
                executionStats: {
                  totalExecutions,
                  successfulExecutions,
                  failedExecutions,
                  averageExecutionTime,
                  lastSuccessfulExecution,
                  lastFailedExecution
                },
                recentLogs,
                schedulingInfo: {
                  isOverdue,
                  nextExecutionDescription,
                  canExecute,
                  validationErrors: validationErrors.length > 0 ? validationErrors : undefined
                }
              };
            } catch (error) {
              console.warn('Failed to add execution data for bot:', bot.id, error);
              return bot; // Return basic bot if execution data fails
            }
          })
        );

        return enhancedBots;
      }

      return bots;
    } catch (error) {
      console.error('Failed to list bots:', error);
      return [];
    }
  }

  /**
   * Smart function to create a bot with automatic user context
   */
  async createBot(data: CreateBotRequest): Promise<Bot> {
    if (!this.useKV) {
      throw new Error('Bot creation not available in static mode');
    }

    try {
      // Validate input data using source of truth schema
      const validData = CreateBotRequestSchema.parse(data);

      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('Authentication required to create bots');
      }

      // Generate bot wallet and assets
      const { generateBotWallet, encryptWalletCredentials } = await import('@/lib/modules/security/wallet-encryption');
      const { createBotImageConfig } = await import('../assets/images');

      const walletCredentials = await generateBotWallet();
      const encryptedWallet = encryptWalletCredentials(walletCredentials);
      const imageConfig = createBotImageConfig(validData.name, walletCredentials.walletAddress, 'pokemon');

      const now = new Date().toISOString();

      const newBotData: Bot = {
        id: walletCredentials.walletAddress,
        name: validData.name,
        strategy: validData.strategy,
        status: 'setup',
        ownerId: userId,
        createdAt: now,
        lastActive: now,
        encryptedWallet: encryptedWallet.encryptedPrivateKey,
        walletIv: encryptedWallet.privateKeyIv,
        publicKey: walletCredentials.publicKey,
        image: imageConfig.image,
        imageType: imageConfig.imageType,
        executionCount: 0,
        // Optional repository configuration
        gitRepository: validData.gitRepository,
        isMonorepo: validData.isMonorepo,
        packagePath: validData.packagePath,
        buildCommands: validData.buildCommands,
      };

      // Validate the complete bot object before storing using source of truth schema
      const newBot = BotSchema.parse(newBotData);

      // Check for ID collision (rare but possible)
      const existingBot = await kv.get<Bot>(`${this.botKeyPrefix}:${newBot.id}`);
      if (existingBot) {
        console.warn(`⚠️ Bot ID collision detected for ${newBot.id}, regenerating wallet...`);
        return this.createBot(data); // Retry with new wallet
      }

      // Atomic creation using KV operations
      await Promise.all([
        kv.set(`${this.botKeyPrefix}:${newBot.id}`, newBot),
        kv.sadd(`${this.userBotIndexPrefix}:${userId}:owned-bots`, newBot.id)
      ]);

      console.log(`✅ Successfully created bot ${newBot.name} with ID ${newBot.id} for user ${userId}`);
      return newBot;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Bot creation validation failed: ${error.issues.map(i => i.message).join(', ')}`);
      }
      console.error('Failed to create bot:', error);
      throw error;
    }
  }

  /**
   * Smart function to update a bot with ownership validation and automatic state transitions
   */
  async updateBot(botId: string, updates: Partial<Bot> & { transitionAction?: string; transitionReason?: string }): Promise<Bot> {
    if (!this.useKV) {
      throw new Error('Bot updates not available in static mode');
    }

    // Validate ownership
    const isOwned = await this.validateBotOwnership(botId);
    if (!isOwned) {
      throw new Error('Bot not found or access denied');
    }

    const userId = await this.getCurrentUserId();
    if (!userId) {
      throw new Error('Authentication required');
    }

    try {
      // Get existing bot
      const rawExistingBot = await kv.get<Bot>(`${this.botKeyPrefix}:${botId}`);
      if (!rawExistingBot) {
        throw new Error('Bot not found');
      }

      // Validate existing bot data from storage
      const existingBot = BotSchema.parse(rawExistingBot);

      const finalBot = { ...existingBot, ...updates };

      // Handle status changes through state machine
      if (updates.status && updates.status !== existingBot.status) {
        throw new Error('Direct status changes not allowed. Use transitionAction instead.');
      }

      // Handle state transitions via transitionAction
      if (updates.transitionAction) {
        const transitionResult = await BotStateMachine.requestTransition(
          existingBot,
          updates.transitionAction,
          userId,
          updates.transitionReason
        );

        if (!transitionResult.success) {
          throw new Error(`State transition failed: ${transitionResult.errors?.join(', ')}`);
        }

        // Apply the transition result
        finalBot.status = transitionResult.toStatus;
        console.log(`✅ State transition completed: ${existingBot.name} (${botId}) ${transitionResult.fromStatus} → ${transitionResult.toStatus}`);
      }

      // Update lastActive and apply all changes
      finalBot.lastActive = new Date().toISOString();

      // Remove transition metadata before storing
      const { transitionAction, transitionReason, ...botToStoreData } = finalBot;

      // Validate the final bot object before storing using source of truth schema
      const botToStore = BotSchema.parse(botToStoreData);

      // Store updated bot
      await kv.set(`${this.botKeyPrefix}:${botId}`, botToStore);

      return botToStore;
    } catch (error) {
      console.error('Failed to update bot:', error);
      throw error;
    }
  }

  /**
   * Smart function to delete a bot with ownership validation and comprehensive cleanup
   */
  async deleteBot(botId: string): Promise<void> {
    if (!this.useKV) {
      throw new Error('Bot deletion not available in static mode');
    }

    const userId = await this.getCurrentUserId();
    if (!userId) {
      throw new Error('Authentication required to delete bots');
    }

    // Validate ownership
    const isOwned = await this.validateBotOwnership(botId);
    if (!isOwned) {
      throw new Error('Bot not found or access denied');
    }

    const deletionErrors: string[] = [];
    let botDeleted = false;

    try {
      console.log(`🗑️ Starting comprehensive deletion of bot ${botId} for user ${userId}`);

      // Clean up all execution data and blob storage
      try {
        const executionCleanup = await executionDataStore.deleteAllExecutionsForBot(botId);
        if (executionCleanup.success && executionCleanup.deletedExecutions > 0) {
          console.log(`✅ Cleaned up ${executionCleanup.deletedExecutions} executions and ${executionCleanup.deletedBlobs} blobs`);
        }
        if (executionCleanup.errors.length > 0) {
          deletionErrors.push(...executionCleanup.errors);
        }
      } catch (executionError) {
        const errorMsg = `Failed to clean execution data: ${executionError instanceof Error ? executionError.message : 'Unknown error'}`;
        deletionErrors.push(errorMsg);
        console.warn(errorMsg);
      }

      // Delete the bot data
      try {
        await kv.del(`${this.botKeyPrefix}:${botId}`);
        botDeleted = true;
        console.log(`✅ Deleted bot data for ${botId}`);
      } catch (botError) {
        const errorMsg = `Failed to delete bot data: ${botError instanceof Error ? botError.message : 'Unknown error'}`;
        deletionErrors.push(errorMsg);
        console.error(errorMsg);
      }

      // Summary and error handling
      if (botDeleted) {
        const successMsg = `✅ Successfully deleted bot ${botId} for user ${userId}`;
        if (deletionErrors.length > 0) {
          console.warn(`${successMsg} (with ${deletionErrors.length} minor cleanup issues)`);
          console.warn('Cleanup issues:', deletionErrors);
        } else {
          console.log(successMsg);
        }
      } else {
        throw new Error(`Failed to delete bot data. Errors: ${deletionErrors.join('; ')}`);
      }

    } catch (error) {
      console.error('Failed to delete bot:', error);
      throw error;
    }
  }




}

// Export singleton instance
export const botService = new BotService();