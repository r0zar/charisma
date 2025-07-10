/**
 * @deprecated This file is kept for backward compatibility.
 * Please import from @/lib/kv-stores instead.
 */

// Re-export everything from the new kv-stores structure
export * from './kv-stores';

// Maintain backward compatibility for existing imports
export type {
  NotificationFilters,
  StoredNotification,
} from './kv-stores';
export {
  botDataStore,
  isKVAvailable,
  notificationStore,
  userDataStore,
} from './kv-stores';