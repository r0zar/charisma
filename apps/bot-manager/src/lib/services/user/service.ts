/**
 * UserService - Controller layer for all user backend operations
 * Handles data source selection (KV vs Static) and provides unified API
 */

// Note: Static data fallbacks removed - use KV store or provide defaults
import { userDataStore } from '@/lib/modules/storage';
import { ENABLE_API_USER } from '@/lib/utils/config';
import { AppSettings, UIPreferences } from '@/schemas/user.schema';
import { WalletState } from '@/schemas/wallet.schema';

// Default values for user data
const defaultSettings: AppSettings = {
  general: {
    isDarkMode: true,
    compactMode: false,
    autoRefresh: true,
  },
  network: {
    network: 'mainnet',
    rpcEndpoint: 'https://stacks-node-api.mainnet.stacks.co',
  },
  botDefaults: {
    defaultStrategy: 'yield-farming',
  },
  notifications: {
    trade: true,
    error: true,
    status: false,
    performance: true,
    security: true,
  },
  notificationChannel: 'browser',
  security: {
    apiKey: 'sk-1234567890abcdef1234567890abcdef12345678',
    autoLockTimeout: '30',
    requireConfirmation: true,
  },
  advanced: {
    debugMode: false,
    performanceMonitoring: true,
  },
};

const defaultPreferences: UIPreferences = {
  sidebarCollapsed: false,
  theme: 'dark',
  skin: 'default',
  language: 'en',
  timezone: 'UTC',
  dateFormat: 'ISO',
  numberFormat: 'US',
};

const defaultWallet: WalletState = {
  isConnected: false,
  address: null,
  network: 'mainnet',
  balance: {
    stx: 0,
    tokens: [],
  },
  transactions: [],
  connectionMethod: null,
};

export interface UserData {
  settings: AppSettings;
  preferences: UIPreferences;
  wallet: WalletState;
}

export class UserService {
  private useKV: boolean;

  constructor() {
    this.useKV = ENABLE_API_USER;
  }

  /**
   * Get complete user data
   */
  async getUserData(userId: string): Promise<UserData> {
    if (this.useKV) {
      const userData = await userDataStore.getUserData(userId);
      return userData || {
        settings: defaultSettings,
        preferences: defaultPreferences,
        wallet: defaultWallet,
      };
    } else {
      // Return default user data
      return {
        settings: defaultSettings,
        preferences: defaultPreferences,
        wallet: defaultWallet,
      };
    }
  }

  /**
   * Get user settings only
   */
  async getUserSettings(userId: string): Promise<AppSettings> {
    if (this.useKV) {
      const userData = await userDataStore.getUserData(userId);
      return userData ? userData.settings : defaultSettings;
    } else {
      return defaultSettings;
    }
  }

  /**
   * Update user settings
   */
  async updateUserSettings(userId: string, settings: Partial<AppSettings>): Promise<AppSettings> {
    if (this.useKV) {
      const updated = await userDataStore.updateUserSettings(userId, settings);
      return updated ? updated.settings : defaultSettings;
    } else {
      throw new Error('User settings updates not available in static mode');
    }
  }

  /**
   * Get user preferences only
   */
  async getUserPreferences(userId: string): Promise<UIPreferences> {
    if (this.useKV) {
      const userData = await userDataStore.getUserData(userId);
      return userData ? userData.preferences : defaultPreferences;
    } else {
      return defaultPreferences;
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<UIPreferences>): Promise<UIPreferences> {
    if (this.useKV) {
      const updated = await userDataStore.updateUserPreferences(userId, preferences);
      return updated ? updated.preferences : defaultPreferences;
    } else {
      throw new Error('User preferences updates not available in static mode');
    }
  }

  /**
   * Get user wallet state
   */
  async getUserWallet(userId: string): Promise<WalletState> {
    if (this.useKV) {
      const userData = await userDataStore.getUserData(userId);
      return userData ? userData.wallet : defaultWallet;
    } else {
      return defaultWallet;
    }
  }

  /**
   * Update user wallet state
   */
  async updateUserWallet(userId: string, wallet: Partial<WalletState>): Promise<WalletState> {
    if (this.useKV) {
      const updated = await userDataStore.updateUserWallet(userId, wallet);
      return updated ? updated.wallet : defaultWallet;
    } else {
      throw new Error('Wallet updates not available in static mode');
    }
  }

  /**
   * Update complete user data
   */
  async updateUserData(userId: string, userData: Partial<UserData>): Promise<UserData> {
    if (this.useKV) {
      const updated = await userDataStore.updateUserData(userId, userData);
      return updated || {
        settings: defaultSettings,
        preferences: defaultPreferences,
        wallet: defaultWallet,
      };
    } else {
      throw new Error('User data updates not available in static mode');
    }
  }

  /**
   * Create user data (for new users)
   */
  async createUserData(userId: string, userData: UserData): Promise<UserData> {
    if (this.useKV) {
      const created = await userDataStore.createUserData(userId, userData);
      return created || {
        settings: defaultSettings,
        preferences: defaultPreferences,
        wallet: defaultWallet,
      };
    } else {
      throw new Error('User creation not available in static mode');
    }
  }

  /**
   * Delete user data
   */
  async deleteUserData(userId: string): Promise<boolean> {
    if (this.useKV) {
      return await userDataStore.deleteUserData(userId);
    } else {
      throw new Error('User deletion not available in static mode');
    }
  }

  /**
   * Check if user exists
   */
  async userExists(userId: string): Promise<boolean> {
    if (this.useKV) {
      return await userDataStore.userExists(userId);
    } else {
      // In static mode, assume user exists if userId matches the default
      return userId === 'default-user';
    }
  }

  /**
   * Get user activity/stats
   */
  async getUserActivity(userId: string): Promise<{
    lastLogin: string;
    totalLogins: number;
    totalBots: number;
    totalNotifications: number;
  }> {
    if (this.useKV) {
      return await userDataStore.getUserActivity(userId);
    } else {
      // No static data - return zero stats
      const totalBots = 0;
      const totalNotifications = 0;
      
      return {
        lastLogin: new Date().toISOString(),
        totalLogins: 1,
        totalBots,
        totalNotifications,
      };
    }
  }

  /**
   * Check if KV mode is enabled
   */
  isKVEnabled(): boolean {
    return this.useKV;
  }

  /**
   * Get data source type
   */
  getDataSource(): 'kv' | 'static' {
    return this.useKV ? 'kv' : 'static';
  }

  /**
   * Get all users data (for SSR scanning)
   */
  async getAllUsersData(): Promise<{ userId: string; userData: UserData }[]> {
    if (this.useKV) {
      return await userDataStore.getAllUsersData();
    } else {
      // For static mode, return the default user data
      return [{
        userId: 'default-user',
        userData: {
          settings: defaultSettings,
          preferences: defaultPreferences,
          wallet: defaultWallet,
        }
      }];
    }
  }
}

// Export singleton instance
export const userService = new UserService();