import { kv } from '@vercel/kv';
import { createHash, randomBytes } from 'crypto';
import {
  ApiKey,
  CreateApiKeyMessage,
  ApiKeyPermission,
  ApiKeyStatus,
  ApiKeyUsageRecord,
  RateLimitInfo,
  API_KEY_PREFIX,
  API_KEY_LENGTH,
  DEFAULT_RATE_LIMIT,
  ApiKeyErrorCode
} from './types';

// Redis key patterns
const API_KEY_HASH_PREFIX = 'api_key:hash:';
const API_KEY_DATA_PREFIX = 'api_key:data:';
const WALLET_KEYS_PREFIX = 'wallet_keys:';
const RATE_LIMIT_PREFIX = 'rate_limit:';
const USAGE_LOG_PREFIX = 'usage_log:';

/**
 * Generate a new API key with the proper prefix and length
 */
export function generateApiKey(): string {
  const randomPart = randomBytes(API_KEY_LENGTH / 2).toString('hex');
  return `${API_KEY_PREFIX}${randomPart}`;
}

/**
 * Hash an API key for secure storage
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Create a masked preview of an API key for display
 */
export function createApiKeyPreview(apiKey: string): string {
  if (apiKey.length < 12) return '••••••••••••';
  return `${apiKey.substring(0, 8)}••••••••••••${apiKey.substring(apiKey.length - 4)}`;
}

/**
 * Create a new API key for a wallet
 */
export async function createApiKey(
  walletAddress: string,
  message: CreateApiKeyMessage,
  rateLimit: number = DEFAULT_RATE_LIMIT
): Promise<{ apiKey: string; keyRecord: ApiKey }> {
  const keyId = randomBytes(16).toString('hex');
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const now = new Date().toISOString();

  // Check for duplicate key names for this wallet
  const existingKeys = await getApiKeysByWallet(walletAddress);
  const duplicateName = existingKeys.find(key =>
    key.name === message.keyName && key.status === 'active'
  );

  if (duplicateName) {
    throw new Error(ApiKeyErrorCode.DUPLICATE_KEY_NAME);
  }

  const keyRecord: ApiKey = {
    id: keyId,
    keyHash,
    keyPreview: createApiKeyPreview(apiKey),
    walletAddress,
    name: message.keyName,
    permissions: message.permissions,
    rateLimit,
    status: 'active',
    createdAt: now,
    expiresAt: message.expiresAt,
    usageStats: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      creationCount: 0,
      executionCount: 0,
      cancellationCount: 0
    }
  };

  // Store the key data
  await kv.hset(API_KEY_DATA_PREFIX + keyId, keyRecord as any);

  // Store hash -> keyId mapping for lookups
  await kv.set(API_KEY_HASH_PREFIX + keyHash, keyId);

  // Add to wallet's key list
  await kv.sadd(WALLET_KEYS_PREFIX + walletAddress, keyId);

  return { apiKey, keyRecord };
}

/**
 * Get API key by hash (for authentication)
 */
export async function getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
  const keyId = await kv.get<string>(API_KEY_HASH_PREFIX + keyHash);
  if (!keyId) return null;

  const keyData = await kv.hgetall(API_KEY_DATA_PREFIX + keyId) as unknown as ApiKey;
  if (!keyData) return null;

  return keyData;
}

/**
 * Get API key by ID
 */
export async function getApiKeyById(keyId: string): Promise<ApiKey | null> {
  const keyData = await kv.hgetall(API_KEY_DATA_PREFIX + keyId) as unknown as ApiKey;
  return keyData || null;
}

/**
 * Get all API keys for a wallet
 */
export async function getApiKeysByWallet(walletAddress: string): Promise<ApiKey[]> {
  const keyIds = await kv.smembers<string[]>(WALLET_KEYS_PREFIX + walletAddress);
  if (!keyIds || keyIds.length === 0) return [];

  const keys: ApiKey[] = [];
  for (const keyId of keyIds) {
    const keyData = await getApiKeyById(keyId);
    if (keyData) {
      keys.push(keyData);
    }
  }

  return keys.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Update API key status or properties
 */
export async function updateApiKey(keyId: string, updates: Partial<ApiKey>): Promise<ApiKey | null> {
  const existingKey = await getApiKeyById(keyId);
  if (!existingKey) return null;

  const updatedKey = { ...existingKey, ...updates };
  await kv.hset(API_KEY_DATA_PREFIX + keyId, updatedKey as any);

  return updatedKey;
}

/**
 * Delete/revoke an API key
 */
export async function deleteApiKey(keyId: string): Promise<boolean> {
  const keyData = await getApiKeyById(keyId);
  if (!keyData) return false;

  // Mark as revoked instead of deleting (for audit trail)
  await updateApiKey(keyId, {
    status: 'revoked',
    lastUsedAt: new Date().toISOString()
  });

  // Remove from hash lookup
  await kv.del(API_KEY_HASH_PREFIX + keyData.keyHash);

  // Remove from wallet's key list
  await kv.srem(WALLET_KEYS_PREFIX + keyData.walletAddress, keyId);

  return true;
}

/**
 * Check and update rate limits for an API key
 */
export async function checkRateLimit(keyId: string, endpoint: string): Promise<RateLimitInfo> {
  const keyData = await getApiKeyById(keyId);
  if (!keyData) {
    throw new Error(ApiKeyErrorCode.KEY_NOT_FOUND);
  }

  const window = 60; // 1 minute window
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % window);
  const rateLimitKey = `${RATE_LIMIT_PREFIX}${keyId}:${windowStart}`;

  // Get current count for this window
  const currentCount = await kv.get<number>(rateLimitKey) || 0;
  const remaining = Math.max(0, keyData.rateLimit - currentCount);

  if (remaining <= 0) {
    return {
      limit: keyData.rateLimit,
      remaining: 0,
      reset: windowStart + window,
      window
    };
  }

  // Increment counter
  await kv.incr(rateLimitKey);
  await kv.expire(rateLimitKey, window * 2); // Keep for 2 windows

  return {
    limit: keyData.rateLimit,
    remaining: remaining - 1,
    reset: windowStart + window,
    window
  };
}

/**
 * Log API key usage
 */
export async function logApiKeyUsage(
  keyId: string,
  endpoint: string,
  method: string,
  success: boolean,
  errorMessage?: string,
  responseTime?: number
): Promise<void> {
  const now = new Date().toISOString();
  const usageRecord: ApiKeyUsageRecord = {
    keyId,
    timestamp: now,
    endpoint,
    method,
    success,
    errorMessage,
    responseTime
  };

  // Store usage log (keep last 1000 entries per key)
  const logKey = `${USAGE_LOG_PREFIX}${keyId}`;
  await kv.lpush(logKey, JSON.stringify(usageRecord));
  await kv.ltrim(logKey, 0, 999); // Keep last 1000 entries

  // Update usage stats
  const keyData = await getApiKeyById(keyId);
  if (keyData) {
    const updates: Partial<ApiKey> = {
      lastUsedAt: now,
      usageStats: {
        ...keyData.usageStats,
        totalRequests: keyData.usageStats.totalRequests + 1,
        successfulRequests: success
          ? keyData.usageStats.successfulRequests + 1
          : keyData.usageStats.successfulRequests,
        failedRequests: success
          ? keyData.usageStats.failedRequests
          : keyData.usageStats.failedRequests + 1
      }
    };

    // Track specific operation counts
    if (success) {
      if (endpoint.includes('/orders') && method === 'POST') {
        updates.usageStats!.creationCount = keyData.usageStats.creationCount + 1;
      } else if (endpoint.includes('/execute')) {
        updates.usageStats!.executionCount = keyData.usageStats.executionCount + 1;
      } else if (endpoint.includes('/cancel')) {
        updates.usageStats!.cancellationCount = keyData.usageStats.cancellationCount + 1;
      }
    }

    await updateApiKey(keyId, updates);
  }
}

/**
 * Get usage logs for an API key
 */
export async function getApiKeyUsageLogs(
  keyId: string,
  limit: number = 100
): Promise<ApiKeyUsageRecord[]> {
  const logKey = `${USAGE_LOG_PREFIX}${keyId}`;
  const logs = await kv.lrange(logKey, 0, limit - 1) as string[];

  if (!logs) return [];

  return logs.map(log => JSON.parse(log) as ApiKeyUsageRecord);
}

/**
 * Validate API key and permissions
 */
export async function validateApiKey(
  apiKey: string,
  requiredWalletAddress: string,
  requiredPermission?: ApiKeyPermission
): Promise<{ valid: boolean; keyRecord?: ApiKey; error?: string; rateLimitInfo?: RateLimitInfo }> {
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return { valid: false, error: ApiKeyErrorCode.INVALID_API_KEY };
  }

  const keyHash = hashApiKey(apiKey);
  const keyRecord = await getApiKeyByHash(keyHash);

  if (!keyRecord) {
    return { valid: false, error: ApiKeyErrorCode.INVALID_API_KEY };
  }

  if (keyRecord.status !== 'active') {
    return { valid: false, error: ApiKeyErrorCode.API_KEY_INACTIVE };
  }

  if (keyRecord.walletAddress !== requiredWalletAddress) {
    return {
      valid: false,
      error: ApiKeyErrorCode.UNAUTHORIZED_WALLET,
      keyRecord
    };
  }

  // Check expiration
  if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
    // Auto-revoke expired key
    await updateApiKey(keyRecord.id, { status: 'revoked' });
    return { valid: false, error: ApiKeyErrorCode.API_KEY_INACTIVE };
  }

  // Check permission
  if (requiredPermission && !keyRecord.permissions.includes(requiredPermission)) {
    return {
      valid: false,
      error: ApiKeyErrorCode.PERMISSION_DENIED,
      keyRecord
    };
  }

  // Check rate limit
  try {
    const rateLimitInfo = await checkRateLimit(keyRecord.id, 'validation');
    if (rateLimitInfo.remaining <= 0) {
      return {
        valid: false,
        error: ApiKeyErrorCode.RATE_LIMIT_EXCEEDED,
        keyRecord,
        rateLimitInfo
      };
    }

    return {
      valid: true,
      keyRecord,
      rateLimitInfo
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Rate limit check failed',
      keyRecord
    };
  }
}

/**
 * Clean up expired API keys (run periodically)
 */
export async function cleanupExpiredKeys(): Promise<number> {
  const now = new Date();
  let cleanupCount = 0;

  // This is a simple implementation - in production, you might want to 
  // scan keys more efficiently or use a background job
  const allKeyHashes = await kv.keys(API_KEY_HASH_PREFIX + '*');

  for (const hashKey of allKeyHashes) {
    const keyId = await kv.get<string>(hashKey);
    if (keyId) {
      const keyData = await getApiKeyById(keyId);
      if (keyData && keyData.expiresAt && new Date(keyData.expiresAt) < now) {
        await updateApiKey(keyId, { status: 'revoked' });
        await kv.del(hashKey);
        cleanupCount++;
      }
    }
  }

  return cleanupCount;
}