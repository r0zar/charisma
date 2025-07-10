import { NextRequest, NextResponse } from 'next/server';
import { appState } from '@/data/app-state';
import { defaultState } from '@/data/default-state';
import { botDataStore, isKVAvailable } from '@/lib/kv-store';
import { BotSchema, CreateBotRequestSchema, type Bot, type CreateBotRequest } from '@/schemas/bot.schema';
import { config } from '@/lib/config';
import { createBotImageConfig } from '@/lib/bot-images';
// Dynamic import for wallet encryption to avoid environment variable requirements
import { verifySignatureAndGetSignerWithTimestamp } from 'blaze-sdk';
import { logger } from '@/lib/server/logger';

/**
 * GET /api/v1/bots
 * Returns bot data (list, stats, activities)
 * Query params:
 * - userId: user ID to get bots for (required for KV)
 * - default: 'true' to use default state (ignores KV)
 * - section: 'list' | 'stats' | 'activities' to get specific section
 * - status: filter bots by status (active, paused, error, setup)
 * - limit: limit number of results
 * - offset: offset for pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const useDefault = searchParams.get('default') === 'true';
    const section = searchParams.get('section') as 'list' | 'stats' | 'activities' | null;
    const status = searchParams.get('status');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;
    
    // Check if we should use KV store or static data
    const useKV = config.enableAPIBots && !useDefault && userId;
    let responseData;
    
    if (useKV) {
      // Use KV store for bot data - requires authentication
      const kvAvailable = await isKVAvailable();
      if (!kvAvailable) {
        return NextResponse.json(
          { 
            error: 'KV store unavailable',
            message: 'Bot data storage is temporarily unavailable',
            timestamp: new Date().toISOString(),
          },
          { status: 503 }
        );
      }

      // Note: Authentication disabled for reading bot data to prevent infinite loops
      // Frontend pages are responsible for only requesting data for connected wallet
      logger.info(`🤖 Bot data request for user: ${userId.slice(0, 8)}...`);
      
      if (section === 'list') {
        // Get bots with filtering and pagination
        let bots = await botDataStore.getAllBots(userId);
        
        // Filter by status
        if (status) {
          bots = bots.filter(bot => bot.status === status);
        }
        
        // Apply pagination
        const total = bots.length;
        if (limit !== undefined) {
          bots = bots.slice(offset, offset + limit);
        }
        
        responseData = {
          list: bots,
          pagination: { offset, limit, total },
          source: 'kv',
          timestamp: new Date().toISOString(),
        };
      } else if (section === 'stats') {
        // Get bot statistics
        const stats = await botDataStore.getBotStats(userId);
        responseData = {
          stats,
          source: 'kv',
          timestamp: new Date().toISOString(),
        };
      } else if (section === 'activities') {
        // Get bot activities with pagination
        const activities = await botDataStore.getAllActivities(userId, limit || 100);
        
        // Apply offset if specified
        const paginatedActivities = activities.slice(offset);
        
        responseData = {
          activities: paginatedActivities,
          pagination: { offset, limit, total: activities.length },
          source: 'kv',
          timestamp: new Date().toISOString(),
        };
      } else {
        // Return all bot data
        const [bots, stats, activities] = await Promise.all([
          botDataStore.getAllBots(userId),
          botDataStore.getBotStats(userId),
          botDataStore.getAllActivities(userId, 50) // Default recent activities
        ]);
        
        // Apply status filter to bots if specified
        let filteredBots = bots;
        if (status) {
          filteredBots = bots.filter(bot => bot.status === status);
        }
        
        // Apply pagination to bots
        const total = filteredBots.length;
        if (limit !== undefined) {
          filteredBots = filteredBots.slice(offset, offset + limit);
        }
        
        responseData = {
          list: filteredBots,
          stats,
          activities,
          pagination: { offset, limit, total },
          source: 'kv',
          timestamp: new Date().toISOString(),
        };
      }
    } else {
      // Use static data (existing implementation)
      const sourceData = useDefault ? defaultState : appState;
      
      if (section) {
      // Return specific section
      if (!sourceData.bots[section]) {
        return NextResponse.json(
          { 
            error: 'Invalid section',
            message: `Section '${section}' not found`,
            timestamp: new Date().toISOString(),
          },
          { status: 404 }
        );
      }
      
      let sectionData: any = sourceData.bots[section];
      
      // Apply filters and pagination for list and activities
      if (section === 'list' && Array.isArray(sectionData)) {
        // Filter by status if specified
        if (status) {
          sectionData = sectionData.filter((bot: any) => bot.status === status);
        }
        
        // Apply pagination
        if (limit !== undefined) {
          sectionData = sectionData.slice(offset, offset + limit);
        }
      } else if (section === 'activities' && Array.isArray(sectionData)) {
        // Apply pagination for activities
        if (limit !== undefined) {
          sectionData = sectionData.slice(offset, offset + limit);
        }
      }
      
      responseData = {
        [section]: sectionData,
        pagination: {
          offset,
          limit,
          total: Array.isArray(sourceData.bots[section]) ? sourceData.bots[section].length : 1,
        },
        source: 'api',
        timestamp: new Date().toISOString(),
      };
    } else {
      // Return all bot data with filters applied
      let botList: any[] = sourceData.bots.list;
      
      // Filter by status if specified
      if (status) {
        botList = botList.filter((bot: any) => bot.status === status);
      }
      
      // Apply pagination to bot list
      if (limit !== undefined) {
        botList = botList.slice(offset, offset + limit);
      }
      
      responseData = {
        list: botList,
        stats: sourceData.bots.stats,
        activities: sourceData.bots.activities,
        pagination: {
          offset,
          limit,
          total: sourceData.bots.list.length,
        },
        source: 'api',
        timestamp: new Date().toISOString(),
      };
    }
    }

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=120',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching bot data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch bot data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/bots
 * Create new bot
 * Body: CreateBotRequest
 * Query params:
 * - userId: user ID to create bot for (required)
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Missing userId',
          message: 'userId query parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }
    
    // Check if bot API is enabled
    if (!config.enableAPIBots) {
      return NextResponse.json(
        { 
          error: 'Bot API disabled',
          message: 'Bot creation via API is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    // Check KV availability
    const kvAvailable = await isKVAvailable();
    if (!kvAvailable) {
      return NextResponse.json(
        { 
          error: 'KV store unavailable',
          message: 'Bot data storage is temporarily unavailable',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    const body = await request.json();
    
    // Validate request body
    const validationResult = CreateBotRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          message: 'Invalid bot data provided',
          details: validationResult.error.issues,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }
    
    const createRequest: CreateBotRequest = validationResult.data;
    
    // Generate bot data
    const botId = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    // Generate real wallet with encryption
    console.log(`[BotAPI] Generating real wallet for bot ${botId}...`);
    const { generateBotWallet, encryptWalletCredentials } = await import('@/lib/wallet-encryption');
    const walletCredentials = await generateBotWallet();
    const encryptedWallet = encryptWalletCredentials(walletCredentials);
    
    console.log(`[BotAPI] Wallet generated for bot ${botId}: ${walletCredentials.walletAddress}`);
    
    // Generate image configuration
    const imageConfig = createBotImageConfig(createRequest.name, botId, 'pokemon');
    
    // Create bot object
    const newBot: Bot = {
      id: botId,
      name: createRequest.name,
      strategy: createRequest.strategy,
      status: 'setup',
      walletAddress: walletCredentials.walletAddress,
      createdAt: now,
      lastActive: now,
      
      // Encrypted wallet data for secure storage
      encryptedWallet: encryptedWallet.encryptedPrivateKey,
      walletIv: encryptedWallet.privateKeyIv,
      
      // Visual identity
      image: imageConfig.image,
      imageType: imageConfig.imageType,
      
      // Initial metrics
      dailyPnL: 0,
      totalPnL: 0,
      totalVolume: 0,
      successRate: 0,
      
      // Initial balances
      stxBalance: 0,
      lpTokenBalances: [],
      rewardTokenBalances: [],
      
      // No activities initially
      recentActivity: [],
      
      // Default scheduling configuration
      isScheduled: false,
      cronSchedule: undefined,
      lastExecution: undefined,
      nextExecution: undefined,
      executionCount: 0,
    };
    
    // Validate the complete bot object
    const botValidation = BotSchema.safeParse(newBot);
    if (!botValidation.success) {
      console.error('Bot validation failed:', botValidation.error);
      return NextResponse.json(
        { 
          error: 'Bot creation failed',
          message: 'Generated bot data is invalid',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
    
    // Store bot in KV
    await botDataStore.createBot(userId, newBot);
    
    return NextResponse.json(
      {
        success: true,
        bot: newBot,
        message: 'Bot created successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
    
  } catch (error) {
    console.error('Error creating bot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create bot',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/bots
 * Update existing bot
 * Body: Bot object
 * Query params:
 * - userId: user ID that owns the bot (required)
 * - botId: bot ID to update (required)
 */
export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const botId = searchParams.get('botId');
    
    if (!userId || !botId) {
      return NextResponse.json(
        { 
          error: 'Missing parameters',
          message: 'userId and botId query parameters are required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }
    
    // Check if bot API is enabled
    if (!config.enableAPIBots) {
      return NextResponse.json(
        { 
          error: 'Bot API disabled',
          message: 'Bot updates via API are not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    // Check KV availability
    const kvAvailable = await isKVAvailable();
    if (!kvAvailable) {
      return NextResponse.json(
        { 
          error: 'KV store unavailable',
          message: 'Bot data storage is temporarily unavailable',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    const body = await request.json();
    
    // Validate request body
    const validationResult = BotSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          message: 'Invalid bot data provided',
          details: validationResult.error.issues,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }
    
    const botUpdate: Bot = validationResult.data;
    
    // Verify bot ID matches
    if (botUpdate.id !== botId) {
      return NextResponse.json(
        { 
          error: 'ID mismatch',
          message: 'Bot ID in body must match botId query parameter',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }
    
    // Check if bot exists
    const existingBot = await botDataStore.getBot(userId, botId);
    if (!existingBot) {
      return NextResponse.json(
        { 
          error: 'Bot not found',
          message: `Bot ${botId} not found for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }
    
    // Update bot in KV
    await botDataStore.updateBot(userId, botUpdate);
    
    return NextResponse.json(
      {
        success: true,
        bot: botUpdate,
        message: 'Bot updated successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Error updating bot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update bot',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/bots
 * Delete a bot
 * Query params:
 * - userId: user ID that owns the bot (required)
 * - botId: bot ID to delete (required)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const botId = searchParams.get('botId');
    
    if (!userId || !botId) {
      return NextResponse.json(
        { 
          error: 'Missing parameters',
          message: 'userId and botId query parameters are required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }
    
    // Check if bot API is enabled
    if (!config.enableAPIBots) {
      return NextResponse.json(
        { 
          error: 'Bot API disabled',
          message: 'Bot deletion via API is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    // Check KV availability
    const kvAvailable = await isKVAvailable();
    if (!kvAvailable) {
      return NextResponse.json(
        { 
          error: 'KV store unavailable',
          message: 'Bot data storage is temporarily unavailable',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
    
    // Check if bot exists
    const existingBot = await botDataStore.getBot(userId, botId);
    if (!existingBot) {
      return NextResponse.json(
        { 
          error: 'Bot not found',
          message: `Bot ${botId} not found for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }
    
    // Delete bot from KV
    await botDataStore.deleteBot(userId, botId);
    
    return NextResponse.json(
      {
        success: true,
        message: 'Bot deleted successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Error deleting bot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete bot',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}