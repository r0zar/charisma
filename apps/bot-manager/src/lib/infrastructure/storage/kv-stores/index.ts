/**
 * KV Storage Services
 * Central exports for all KV store services and utilities
 */

// Export store classes
export { UserDataKVStore } from './user-store';
export { BotKVStore } from './bot-store';
export { NotificationKVStore } from './notification-store';

// Export types and utilities
export type { StoredNotification, NotificationFilters } from './types';
export { isKVAvailable } from './types';

// Create and export singleton instances
import { UserDataKVStore } from './user-store';
import { BotKVStore } from './bot-store';
import { NotificationKVStore } from './notification-store';

export const userDataStore = new UserDataKVStore();
export const botDataStore = new BotKVStore();
export const notificationStore = new NotificationKVStore();