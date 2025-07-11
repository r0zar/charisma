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
   * Update user settings
   */
  async updateUserSettings(userId: string, settings: any): Promise<AppState['user'] | null> {
    const userData = await this.getUserData(userId);
    if (!userData) return null;
    return this.updateUserData(userId, { settings });
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
   * Update wallet state
   */
  async updateWalletState(userId: string, wallet: any): Promise<AppState['user'] | null> {
    const userData = await this.getUserData(userId);
    if (!userData) return null;
    return this.updateUserData(userId, { wallet });
  }
}