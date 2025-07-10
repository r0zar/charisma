/**
 * Domain-specific data exports
 * Provides clean separation of concerns for app state data
 */

// Metadata exports (now dynamic)
export { getMetadataData } from './metadata';

// User data exports
export { userSettingsData, userPreferencesData, userWalletData } from './user';

// Bot data exports
export { botListData, botStatsData } from './bots';

// Market data exports removed

// Notification data exports
export { notificationsData } from './notifications';