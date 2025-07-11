/**
 * KV Storage Services
 * Central exports for all KV store services and utilities
 */

// Export store classes
// Create and export singleton instances
import { BotKVStore } from './bot-store';
import { NotificationKVStore } from './notification-store';
import { UserDataKVStore } from './user-store';

export { BotKVStore } from './bot-store';
export { NotificationKVStore } from './notification-store';
export { UserDataKVStore } from './user-store';

// Note: StoredNotification should be defined in notification-related files
// NotificationFilters should be defined in notification client

export const userDataStore = new UserDataKVStore();
export const botDataStore = new BotKVStore();
export const notificationStore = new NotificationKVStore();