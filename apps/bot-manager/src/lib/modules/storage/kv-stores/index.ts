/**
 * KV Storage Services
 * Central exports for all KV store services and utilities
 */

// Export store classes
// Create and export singleton instances
import { ExecutionKVStore } from './execution-store';
import { NotificationKVStore } from './notification-store';
import { UserDataKVStore } from './user-store';

export { ExecutionKVStore } from './execution-store';
export { NotificationKVStore } from './notification-store';
export { UserDataKVStore } from './user-store';

export const userDataStore = new UserDataKVStore();
export const executionDataStore = new ExecutionKVStore();
export const notificationStore = new NotificationKVStore();