/**
 * Notification Templates for Event-Driven Notifications
 * 
 * Provides standardized notification content for different system events
 */

import { StoredNotification } from '@/lib/kv-store';

export type NotificationEventType = 
  | 'bot_offline'
  | 'bot_started'
  | 'bot_low_funds'
  | 'high_value_transaction'
  | 'transaction_failed'
  | 'unusual_activity'
  | 'system_error'
  | 'analytics_failure'
  | 'kv_connection_issue';

export interface NotificationEventData {
  botId?: string;
  botName?: string;
  walletAddress?: string;
  amount?: number;
  txHash?: string;
  error?: string;
  threshold?: number;
  activityType?: string;
  systemComponent?: string;
  [key: string]: any;
}

export interface NotificationTemplate {
  type: 'success' | 'error' | 'warning' | 'info';
  priority: 'high' | 'medium' | 'low';
  category: string;
  titleTemplate: string;
  messageTemplate: string;
  deduplicationKey?: string;
}

/**
 * Template definitions for different notification events
 */
export const NOTIFICATION_TEMPLATES: Record<NotificationEventType, NotificationTemplate> = {
  // Bot Status Events
  bot_offline: {
    type: 'error',
    priority: 'high',
    category: 'bot_status',
    titleTemplate: 'Bot Offline: {botName}',
    messageTemplate: 'Bot {botName} has gone offline and stopped responding. Check bot status and logs.',
    deduplicationKey: 'bot_offline_{botId}'
  },

  bot_started: {
    type: 'success',
    priority: 'medium',
    category: 'bot_status',
    titleTemplate: 'Bot Started: {botName}',
    messageTemplate: 'Bot {botName} has successfully started and is now active.',
    deduplicationKey: 'bot_started_{botId}'
  },

  bot_low_funds: {
    type: 'warning',
    priority: 'high',
    category: 'bot_funding',
    titleTemplate: 'Low Funds: {botName}',
    messageTemplate: 'Bot {botName} has low funds ({amount} STX remaining). Consider adding more funds to continue operations.',
    deduplicationKey: 'bot_low_funds_{botId}'
  },

  // Activity Events
  high_value_transaction: {
    type: 'info',
    priority: 'medium',
    category: 'activity',
    titleTemplate: 'High-Value Transaction',
    messageTemplate: 'Bot {botName} completed a high-value transaction of {amount}. View transaction details for more info.',
    deduplicationKey: 'high_value_{txHash}'
  },

  transaction_failed: {
    type: 'error',
    priority: 'high',
    category: 'activity',
    titleTemplate: 'Transaction Failed: {botName}',
    messageTemplate: 'Bot {botName} transaction failed: {error}. Check bot logs and wallet status.',
    deduplicationKey: 'tx_failed_{botId}_{txHash}'
  },

  unusual_activity: {
    type: 'warning',
    priority: 'medium',
    category: 'activity',
    titleTemplate: 'Unusual Activity Detected',
    messageTemplate: 'Bot {botName} showing unusual {activityType} activity. Review recent transactions and strategy performance.',
    deduplicationKey: 'unusual_activity_{botId}_{activityType}'
  },

  // System Events
  system_error: {
    type: 'error',
    priority: 'high',
    category: 'system',
    titleTemplate: 'System Error',
    messageTemplate: 'System component {systemComponent} encountered an error: {error}',
    deduplicationKey: 'system_error_{systemComponent}'
  },

  analytics_failure: {
    type: 'warning',
    priority: 'medium',
    category: 'system',
    titleTemplate: 'Analytics Collection Failed',
    messageTemplate: 'Analytics data collection failed for wallet {walletAddress}. Some metrics may be outdated.',
    deduplicationKey: 'analytics_failure_{walletAddress}'
  },

  kv_connection_issue: {
    type: 'error',
    priority: 'high',
    category: 'system',
    titleTemplate: 'Database Connection Issue',
    messageTemplate: 'KV store connection issues detected. Some features may be temporarily unavailable.',
    deduplicationKey: 'kv_connection_issue'
  }
};

/**
 * Generate notification content from template and data
 */
export function generateNotificationFromTemplate(
  eventType: NotificationEventType,
  data: NotificationEventData,
  userId: string
): Omit<StoredNotification, 'id' | 'createdAt' | 'updatedAt'> {
  const template = NOTIFICATION_TEMPLATES[eventType];
  
  if (!template) {
    throw new Error(`No template found for event type: ${eventType}`);
  }

  // Replace template placeholders with actual data
  const title = replacePlaceholders(template.titleTemplate, data);
  const message = replacePlaceholders(template.messageTemplate, data);

  return {
    type: template.type,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
    priority: template.priority,
    category: template.category,
    metadata: {
      eventType,
      userId,
      deduplicationKey: template.deduplicationKey ? replacePlaceholders(template.deduplicationKey, data) : undefined,
      originalData: data
    }
  };
}

/**
 * Replace placeholders in template string with data values
 */
function replacePlaceholders(template: string, data: NotificationEventData): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = data[key];
    
    if (value === undefined || value === null) {
      return match; // Keep placeholder if no data
    }
    
    // Format specific data types
    if (key === 'amount' && typeof value === 'number') {
      return formatCurrency(value);
    }
    
    if (key === 'walletAddress' && typeof value === 'string') {
      return `${value.slice(0, 8)}...${value.slice(-4)}`;
    }
    
    return String(value);
  });
}

/**
 * Simple currency formatter
 */
function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(2)}`;
}

/**
 * Check if notification should be deduplicated
 */
export function getDeduplicationKey(
  eventType: NotificationEventType,
  data: NotificationEventData
): string | undefined {
  const template = NOTIFICATION_TEMPLATES[eventType];
  
  if (!template.deduplicationKey) {
    return undefined;
  }
  
  return replacePlaceholders(template.deduplicationKey, data);
}

/**
 * Get notification priority score for sorting
 */
export function getNotificationPriorityScore(priority: 'high' | 'medium' | 'low'): number {
  switch (priority) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}