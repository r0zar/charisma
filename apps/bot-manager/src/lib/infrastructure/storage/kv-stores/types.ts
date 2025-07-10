/**
 * Shared types for KV storage services
 */

// Types for stored data
export interface StoredNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
  category: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationFilters {
  type?: string;
  category?: string;
  read?: boolean;
  priority?: string;
  limit?: number;
  offset?: number;
}

/**
 * Check if KV storage is available
 */
export async function isKVAvailable(): Promise<boolean> {
  try {
    const { kv } = await import('@vercel/kv');
    // Try to set and get a test key
    const testKey = `bot-manager:kv_test_${  Date.now()}`;
    await kv.set(testKey, 'test', { ex: 1 }); // Expire in 1 second
    const result = await kv.get(testKey);
    return result === 'test';
  } catch (error) {
    console.error('KV not available:', error);
    return false;
  }
}