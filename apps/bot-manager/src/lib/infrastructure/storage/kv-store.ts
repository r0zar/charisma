/**
 * @deprecated This file is kept for backward compatibility.
 * Please import from @/lib/kv-stores instead.
 */

// Re-export everything from the new kv-stores structure
export * from './kv-stores';

// Maintain backward compatibility for existing imports
export {
  userDataStore,
  botDataStore,
  notificationStore,
  isKVAvailable,
} from './kv-stores';

export type {
  StoredNotification,
  NotificationFilters,
} from './kv-stores';