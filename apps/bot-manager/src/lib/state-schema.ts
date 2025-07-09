// State Schema Validation and Type Guards
import { AppState, StateValidationResult } from '@/types/app-state';
import { Bot } from '@/types/bot';

// Type Guards
export function isValidAppState(data: any): data is AppState {
  if (!data || typeof data !== 'object') return false;
  
  // Check required top-level properties
  if (!data.metadata || !data.user || !data.bots || !data.market || !data.notifications) {
    return false;
  }
  
  // Check metadata structure
  if (!data.metadata.version || !data.metadata.generatedAt || !data.metadata.profile) {
    return false;
  }
  
  // Check user structure
  if (!data.user.settings || !data.user.wallet || !data.user.preferences) {
    return false;
  }
  
  // Check bots structure
  if (!Array.isArray(data.bots.list) || !data.bots.stats || !Array.isArray(data.bots.activities)) {
    return false;
  }
  
  // Check market structure
  if (!data.market.data || !data.market.analytics || !Array.isArray(data.market.pools)) {
    return false;
  }
  
  // Check notifications
  if (!Array.isArray(data.notifications)) {
    return false;
  }
  
  return true;
}

export function isValidBot(data: any): data is Bot {
  if (!data || typeof data !== 'object') return false;
  
  const requiredFields = ['id', 'name', 'strategy', 'status', 'walletAddress', 'createdAt'];
  return requiredFields.every(field => field in data);
}

// Schema Validation Functions
export function validateAppState(data: any): StateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Basic structure validation
  if (!isValidAppState(data)) {
    errors.push('Invalid app state structure');
    return {
      isValid: false,
      errors,
      warnings,
      metadata: {
        version: 'unknown',
        botCount: 0,
        totalActivities: 0,
        dataSize: JSON.stringify(data).length,
      },
    };
  }
  
  // Validate metadata
  if (!data.metadata.version.match(/^\d+\.\d+\.\d+$/)) {
    errors.push('Invalid version format in metadata');
  }
  
  const validProfiles = ['development', 'demo', 'testing', 'production'];
  if (!validProfiles.includes(data.metadata.profile)) {
    errors.push(`Invalid profile: ${data.metadata.profile}`);
  }
  
  // Validate user data
  if (!data.user.wallet.address && data.user.wallet.isConnected) {
    errors.push('Wallet is connected but no address provided');
  }
  
  if (data.user.wallet.balance.stx < 0) {
    errors.push('Negative STX balance');
  }
  
  // Validate bots
  data.bots.list.forEach((bot: any, index: number) => {
    if (!isValidBot(bot)) {
      errors.push(`Invalid bot structure at index ${index}`);
    }
    
    if (bot.dailyPnL > 10000) {
      warnings.push(`Bot ${bot.name} has unusually high daily P&L: ${bot.dailyPnL}`);
    }
    
    if (bot.successRate > 100 || bot.successRate < 0) {
      errors.push(`Bot ${bot.name} has invalid success rate: ${bot.successRate}`);
    }
    
    if (bot.stxBalance < 0) {
      errors.push(`Bot ${bot.name} has negative STX balance`);
    }
  });
  
  // Validate bot activities
  data.bots.activities.forEach((activity: any, index: number) => {
    if (!activity.id || !activity.botId || !activity.timestamp) {
      errors.push(`Invalid activity structure at index ${index}`);
    }
    
    const validTypes = ['yield-farming', 'deposit', 'withdrawal', 'trade', 'error'];
    if (!validTypes.includes(activity.type)) {
      errors.push(`Invalid activity type: ${activity.type}`);
    }
    
    const validStatuses = ['pending', 'success', 'failed'];
    if (!validStatuses.includes(activity.status)) {
      errors.push(`Invalid activity status: ${activity.status}`);
    }
  });
  
  // Validate market data
  if (!data.market.data.tokenPrices || typeof data.market.data.tokenPrices !== 'object') {
    errors.push('Invalid token prices structure');
  }
  
  // Check for reasonable token prices
  Object.entries(data.market.data.tokenPrices).forEach(([token, price]) => {
    if (typeof price !== 'number' || price <= 0) {
      errors.push(`Invalid price for token ${token}: ${price}`);
    }
    
    if (price > 1000000) {
      warnings.push(`Token ${token} has unusually high price: ${price}`);
    }
  });
  
  // Validate DeFi pools
  data.market.pools.forEach((pool: any, index: number) => {
    if (!pool.id || !pool.name || !pool.tokenA || !pool.tokenB) {
      errors.push(`Invalid pool structure at index ${index}`);
    }
    
    if (pool.apr < 0 || pool.apr > 1000) {
      warnings.push(`Pool ${pool.name} has unusual APR: ${pool.apr}%`);
    }
    
    if (pool.totalValueLocked < 0) {
      errors.push(`Pool ${pool.name} has negative TVL`);
    }
  });
  
  // Validate notifications
  data.notifications.forEach((notification: any, index: number) => {
    if (!notification.id || !notification.type || !notification.title) {
      errors.push(`Invalid notification structure at index ${index}`);
    }
    
    const validTypes = ['success', 'error', 'warning', 'info'];
    if (!validTypes.includes(notification.type)) {
      errors.push(`Invalid notification type: ${notification.type}`);
    }
  });
  
  // Data consistency checks
  const botIds = new Set(data.bots.list.map((bot: Bot) => bot.id));
  const activityBotIds = new Set(data.bots.activities.map((activity: any) => activity.botId));
  
  activityBotIds.forEach(botId => {
    if (!botIds.has(botId)) {
      errors.push(`Activity references non-existent bot: ${botId}`);
    }
  });
  
  // Statistical validation
  const totalBots = data.bots.list.length;
  const activeBots = data.bots.list.filter((bot: Bot) => bot.status === 'active').length;
  const pausedBots = data.bots.list.filter((bot: Bot) => bot.status === 'paused').length;
  
  if (data.bots.stats.totalBots !== totalBots) {
    errors.push(`Bot stats mismatch: stats.totalBots=${data.bots.stats.totalBots}, actual=${totalBots}`);
  }
  
  if (data.bots.stats.activeBots !== activeBots) {
    errors.push(`Bot stats mismatch: stats.activeBots=${data.bots.stats.activeBots}, actual=${activeBots}`);
  }
  
  if (data.bots.stats.pausedBots !== pausedBots) {
    errors.push(`Bot stats mismatch: stats.pausedBots=${data.bots.stats.pausedBots}, actual=${pausedBots}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      version: data.metadata.version,
      botCount: data.bots.list.length,
      totalActivities: data.bots.activities.length,
      dataSize: JSON.stringify(data).length,
    },
  };
}

// Schema version handling
export const CURRENT_SCHEMA_VERSION = '1.0.0';

export function isCompatibleVersion(version: string): boolean {
  const [major, minor, patch] = version.split('.').map(Number);
  const [currentMajor, currentMinor, currentPatch] = CURRENT_SCHEMA_VERSION.split('.').map(Number);
  
  // Same major version is compatible
  if (major === currentMajor) {
    return true;
  }
  
  // Future major versions are not compatible
  if (major > currentMajor) {
    return false;
  }
  
  // Past major versions might need migration
  return false;
}

// Utility functions for schema information
export function getSchemaInfo() {
  return {
    version: CURRENT_SCHEMA_VERSION,
    supportedProfiles: ['development', 'demo', 'testing', 'production'],
    requiredFields: {
      metadata: ['version', 'generatedAt', 'profile'],
      user: ['settings', 'wallet', 'preferences'],
      bots: ['list', 'stats', 'activities'],
      market: ['data', 'analytics', 'pools'],
      notifications: [],
    },
  };
}

// Export validation functions
export default validateAppState;