/**
 * Notifications Feature
 * Notification-specific functionality, client, and service layer
 */

export { NotificationsApiClient } from './client';
export type { CreateNotificationData,NotificationFilters, NotificationSummary } from './service';
export { NotificationService } from './service';