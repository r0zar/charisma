/**
 * User data storage service using Vercel KV for multiple users
 */

import { kv } from '@vercel/kv';

import type { AppState } from '@/schemas/app-state.schema';

export class UserDataKVStore {
  private readonly keyPrefix = 'bot-manager:user';

  /**
   * Get user data from KV store
   */
  async getUserData(userId: string): Promise<AppState['user'] | null> {
    try {
      const userData = await kv.get(`${this.keyPrefix}:${userId}`);
      return userData as AppState['user'] | null;
    } catch (error) {
      console.error('Failed to get user data:', error);
      return null;
    }
  }

  /**
   * Store user data in KV store
   */
  async setUserData(userId: string, userData: AppState['user']): Promise<boolean> {
    try {
      await kv.set(`${this.keyPrefix}:${userId}`, userData);
      return true;
    } catch (error) {
      console.error('Failed to set user data:', error);
      return false;
    }
  }

  /**
   * Update user data in KV store
   */
  async updateUserData(userId: string, updates: Partial<AppState['user']>): Promise<AppState['user'] | null> {
    try {
      const currentData = await this.getUserData(userId);
      if (!currentData) {
        return null;
      }

      const updatedData = {
        ...currentData,
        ...updates,
      };

      const success = await this.setUserData(userId, updatedData);
      return success ? updatedData : null;
    } catch (error) {
      console.error('Failed to update user data:', error);
      return null;
    }
  }

  /**
   * Clear user data from KV store
   */
  async clearUserData(userId: string): Promise<boolean> {
    try {
      await kv.del(`${this.keyPrefix}:${userId}`);
      return true;
    } catch (error) {
      console.error('Failed to clear user data:', error);
      return false;
    }
  }

  /**
   * Check if user data exists
   */
  async hasUserData(userId: string): Promise<boolean> {
    try {
      const userData = await kv.get(`${this.keyPrefix}:${userId}`);
      return userData !== null;
    } catch (error) {
      console.error('Failed to check user data existence:', error);
      return false;
    }
  }

  /**
   * Get all user IDs
   */
  async getAllUserIds(): Promise<string[]> {
    try {
      // Use SCAN to find all keys with the user prefix
      const keys = await kv.keys(`${this.keyPrefix}:*`);
      return keys.map(key => key.replace(`${this.keyPrefix}:`, ''));
    } catch (error) {
      console.error('Failed to get all user IDs:', error);
      return [];
    }
  }

  /**
   * Get user settings
   */
  async getUserSettings(userId: string): Promise<AppState['user']['settings'] | null> {
    const userData = await this.getUserData(userId);
    return userData?.settings || null;
  }

  /**
   * Update user settings
   */
  async updateUserSettings(userId: string, settings: any): Promise<AppState['user'] | null> {
    const userData = await this.getUserData(userId);
    if (!userData) return null;
    return this.updateUserData(userId, { settings });
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<AppState['user']['preferences'] | null> {
    const userData = await this.getUserData(userId);
    return userData?.preferences || null;
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: any): Promise<AppState['user'] | null> {
    const userData = await this.getUserData(userId);
    if (!userData) return null;
    return this.updateUserData(userId, { preferences });
  }

  /**
   * Get wallet state
   */
  async getWalletState(userId: string): Promise<AppState['user']['wallet'] | null> {
    const userData = await this.getUserData(userId);
    return userData?.wallet || null;
  }

  /**
   * Update wallet state
   */
  async updateWalletState(userId: string, wallet: any): Promise<AppState['user'] | null> {
    const userData = await this.getUserData(userId);
    if (!userData) return null;
    return this.updateUserData(userId, { wallet });
  }

  /**
   * Get user wallet state (alias for getWalletState)
   */
  async getUserWallet(userId: string): Promise<AppState['user']['wallet'] | null> {
    return this.getWalletState(userId);
  }

  /**
   * Update user wallet (alias for updateWalletState)
   */
  async updateUserWallet(userId: string, wallet: any): Promise<AppState['user'] | null> {
    return this.updateWalletState(userId, wallet);
  }

  /**
   * Create user data (alias for setUserData)
   */
  async createUserData(userId: string, userData: AppState['user']): Promise<AppState['user'] | null> {
    const success = await this.setUserData(userId, userData);
    return success ? userData : null;
  }

  /**
   * Delete user data (alias for clearUserData)
   */
  async deleteUserData(userId: string): Promise<boolean> {
    return this.clearUserData(userId);
  }

  /**
   * Check if user exists (alias for hasUserData)
   */
  async userExists(userId: string): Promise<boolean> {
    return this.hasUserData(userId);
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
    try {
      const userData = await this.getUserData(userId);
      if (!userData) {
        return {
          lastLogin: new Date().toISOString(),
          totalLogins: 0,
          totalBots: 0,
          totalNotifications: 0,
        };
      }

      // For now, return basic stats - you could extend this with more detailed tracking
      return {
        lastLogin: new Date().toISOString(),
        totalLogins: 1,
        totalBots: 0, // Would need to query bots by ownerId
        totalNotifications: 0, // Would need to query notifications by userId
      };
    } catch (error) {
      console.error('Failed to get user activity:', error);
      return {
        lastLogin: new Date().toISOString(),
        totalLogins: 0,
        totalBots: 0,
        totalNotifications: 0,
      };
    }
  }

  /**
   * Get all users data (for SSR scanning)
   */
  async getAllUsersData(): Promise<{ userId: string; userData: AppState['user'] }[]> {
    try {
      const userIds = await this.getAllUserIds();
      const allUsers: { userId: string; userData: AppState['user'] }[] = [];

      for (const userId of userIds) {
        const userData = await this.getUserData(userId);
        if (userData) {
          allUsers.push({ userId, userData });
        }
      }

      return allUsers;
    } catch (error) {
      console.error('Failed to get all users data:', error);
      return [];
    }
  }
}