import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  generateApiKey, 
  hashApiKey, 
  createApiKey,
  validateApiKey,
  deleteApiKey
} from '../store';
import { CreateApiKeyMessage, API_KEY_PREFIX, ApiKeyErrorCode } from '../types';

// Mock Redis/KV
vi.mock('@vercel/kv', () => ({
  kv: {
    hset: vi.fn(),
    hgetall: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    sadd: vi.fn(),
    srem: vi.fn(),
    smembers: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    lpush: vi.fn(),
    ltrim: vi.fn(),
    lrange: vi.fn(),
    keys: vi.fn()
  }
}));

describe('API Key Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateApiKey', () => {
    it('should generate API key with correct prefix', () => {
      const apiKey = generateApiKey();
      expect(apiKey).toMatch(new RegExp(`^${API_KEY_PREFIX}`));
      expect(apiKey.length).toBeGreaterThan(API_KEY_PREFIX.length);
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('hashApiKey', () => {
    it('should hash API key consistently', () => {
      const apiKey = 'ck_live_test123';
      const hash1 = hashApiKey(apiKey);
      const hash2 = hashApiKey(apiKey);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = hashApiKey('ck_live_test123');
      const hash2 = hashApiKey('ck_live_test456');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('createApiKey', () => {
    it('should create API key with correct structure', async () => {
      const walletAddress = 'SP1ABC123DEF456';
      const message: CreateApiKeyMessage = {
        action: 'create_api_key',
        keyName: 'Test Key',
        permissions: ['create', 'execute', 'cancel'],
        timestamp: Date.now()
      };

      // Mock successful KV operations
      const { kv } = await import('@vercel/kv');
      vi.mocked(kv.hset).mockResolvedValue(1);
      vi.mocked(kv.set).mockResolvedValue('OK');
      vi.mocked(kv.sadd).mockResolvedValue(1);
      vi.mocked(kv.smembers).mockResolvedValue([]);

      const result = await createApiKey(walletAddress, message);

      expect(result.apiKey).toMatch(new RegExp(`^${API_KEY_PREFIX}`));
      expect(result.keyRecord).toMatchObject({
        walletAddress,
        name: message.keyName,
        permissions: ['create', 'execute', 'cancel'],
        status: 'active',
        rateLimit: 100,
        usageStats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          creationCount: 0,
          executionCount: 0,
          cancellationCount: 0
        }
      });

      expect(kv.hset).toHaveBeenCalled();
      expect(kv.set).toHaveBeenCalled();
      expect(kv.sadd).toHaveBeenCalled();
    });

    it('should throw error for duplicate key name', async () => {
      const walletAddress = 'SP1ABC123DEF456';
      const message: CreateApiKeyMessage = {
        action: 'create_api_key',
        keyName: 'Duplicate Key',
        permissions: ['execute'],
        timestamp: Date.now()
      };

      // Mock existing key with same name
      const { kv } = await import('@vercel/kv');
      vi.mocked(kv.smembers).mockResolvedValue(['existing-key-id']);
      vi.mocked(kv.hgetall).mockResolvedValue({
        id: 'existing-key-id',
        name: 'Duplicate Key',
        status: 'active',
        walletAddress
      });

      await expect(createApiKey(walletAddress, message)).rejects.toThrow(ApiKeyErrorCode.DUPLICATE_KEY_NAME);
    });
  });

  describe('validateApiKey', () => {
    it('should validate active API key successfully', async () => {
      const apiKey = 'ck_live_test123';
      const walletAddress = 'SP1ABC123DEF456';
      const keyHash = hashApiKey(apiKey);
      
      const mockKeyRecord = {
        id: 'key-123',
        keyHash,
        walletAddress,
        name: 'Test Key',
        permissions: ['execute', 'cancel'],
        status: 'active',
        rateLimit: 100,
        createdAt: new Date().toISOString(),
        usageStats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          creationCount: 0,
          executionCount: 0,
          cancellationCount: 0
        }
      };

      const { kv } = await import('@vercel/kv');
      vi.mocked(kv.get).mockResolvedValueOnce('key-123'); // hash lookup
      vi.mocked(kv.hgetall).mockResolvedValueOnce(mockKeyRecord); // key data
      vi.mocked(kv.get).mockResolvedValueOnce(0); // rate limit count
      vi.mocked(kv.incr).mockResolvedValueOnce(1);
      vi.mocked(kv.expire).mockResolvedValueOnce(1);

      const result = await validateApiKey(apiKey, walletAddress, 'execute');

      expect(result.valid).toBe(true);
      expect(result.keyRecord).toEqual(mockKeyRecord);
      expect(result.rateLimitInfo).toBeDefined();
    });

    it('should reject invalid API key format', async () => {
      const result = await validateApiKey('invalid-key', 'SP1ABC123DEF456');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ApiKeyErrorCode.INVALID_API_KEY);
    });

    it('should reject API key for wrong wallet', async () => {
      const apiKey = 'ck_live_test123';
      const keyHash = hashApiKey(apiKey);
      
      const mockKeyRecord = {
        id: 'key-123',
        keyHash,
        walletAddress: 'SP1DIFFERENT456',
        name: 'Test Key',
        permissions: ['execute'],
        status: 'active',
        rateLimit: 100,
        createdAt: new Date().toISOString(),
        usageStats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          creationCount: 0,
          executionCount: 0,
          cancellationCount: 0
        }
      };

      const { kv } = await import('@vercel/kv');
      vi.mocked(kv.get).mockResolvedValueOnce('key-123');
      vi.mocked(kv.hgetall).mockResolvedValueOnce(mockKeyRecord);

      const result = await validateApiKey(apiKey, 'SP1ABC123DEF456');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ApiKeyErrorCode.UNAUTHORIZED_WALLET);
    });

    it('should reject revoked API key', async () => {
      const apiKey = 'ck_live_test123';
      const keyHash = hashApiKey(apiKey);
      
      const mockKeyRecord = {
        id: 'key-123',
        keyHash,
        walletAddress: 'SP1ABC123DEF456',
        name: 'Test Key',
        permissions: ['execute'],
        status: 'revoked',
        rateLimit: 100,
        createdAt: new Date().toISOString(),
        usageStats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          creationCount: 0,
          executionCount: 0,
          cancellationCount: 0
        }
      };

      const { kv } = await import('@vercel/kv');
      vi.mocked(kv.get).mockResolvedValueOnce('key-123');
      vi.mocked(kv.hgetall).mockResolvedValueOnce(mockKeyRecord);

      const result = await validateApiKey(apiKey, 'SP1ABC123DEF456');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ApiKeyErrorCode.API_KEY_INACTIVE);
    });

    it('should reject API key without required permission', async () => {
      const apiKey = 'ck_live_test123';
      const keyHash = hashApiKey(apiKey);
      
      const mockKeyRecord = {
        id: 'key-123',
        keyHash,
        walletAddress: 'SP1ABC123DEF456',
        name: 'Test Key',
        permissions: ['cancel'], // No execute permission
        status: 'active',
        rateLimit: 100,
        createdAt: new Date().toISOString(),
        usageStats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          creationCount: 0,
          executionCount: 0,
          cancellationCount: 0
        }
      };

      const { kv } = await import('@vercel/kv');
      vi.mocked(kv.get).mockResolvedValueOnce('key-123');
      vi.mocked(kv.hgetall).mockResolvedValueOnce(mockKeyRecord);

      const result = await validateApiKey(apiKey, 'SP1ABC123DEF456', 'execute');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ApiKeyErrorCode.PERMISSION_DENIED);
    });

    it('should validate API key with create permission', async () => {
      const apiKey = 'ck_live_test123';
      const keyHash = hashApiKey(apiKey);
      
      const mockKeyRecord = {
        id: 'key-123',
        keyHash,
        walletAddress: 'SP1ABC123DEF456',
        name: 'Test Key',
        permissions: ['create', 'execute'], // Has create permission
        status: 'active',
        rateLimit: 100,
        createdAt: new Date().toISOString(),
        usageStats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          creationCount: 0,
          executionCount: 0,
          cancellationCount: 0
        }
      };

      const { kv } = await import('@vercel/kv');
      vi.mocked(kv.get).mockResolvedValueOnce('key-123'); // hash lookup
      vi.mocked(kv.hgetall).mockResolvedValueOnce(mockKeyRecord); // key data
      vi.mocked(kv.get).mockResolvedValueOnce(0); // rate limit count
      vi.mocked(kv.incr).mockResolvedValueOnce(1);
      vi.mocked(kv.expire).mockResolvedValueOnce(1);

      const result = await validateApiKey(apiKey, 'SP1ABC123DEF456', 'create');
      expect(result.valid).toBe(true);
      expect(result.keyRecord).toEqual(mockKeyRecord);
    });

    it('should reject API key without create permission', async () => {
      const apiKey = 'ck_live_test123';
      const keyHash = hashApiKey(apiKey);
      
      const mockKeyRecord = {
        id: 'key-123',
        keyHash,
        walletAddress: 'SP1ABC123DEF456',
        name: 'Test Key',
        permissions: ['execute', 'cancel'], // No create permission
        status: 'active',
        rateLimit: 100,
        createdAt: new Date().toISOString(),
        usageStats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          creationCount: 0,
          executionCount: 0,
          cancellationCount: 0
        }
      };

      const { kv } = await import('@vercel/kv');
      vi.mocked(kv.get).mockResolvedValueOnce('key-123');
      vi.mocked(kv.hgetall).mockResolvedValueOnce(mockKeyRecord);

      const result = await validateApiKey(apiKey, 'SP1ABC123DEF456', 'create');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ApiKeyErrorCode.PERMISSION_DENIED);
    });
  });

  describe('deleteApiKey', () => {
    it('should mark API key as revoked', async () => {
      const keyId = 'key-123';
      const mockKeyRecord = {
        id: keyId,
        keyHash: 'hash123',
        walletAddress: 'SP1ABC123DEF456',
        name: 'Test Key',
        permissions: ['execute'],
        status: 'active',
        rateLimit: 100,
        createdAt: new Date().toISOString(),
        usageStats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          creationCount: 0,
          executionCount: 0,
          cancellationCount: 0
        }
      };

      const { kv } = await import('@vercel/kv');
      vi.mocked(kv.hgetall).mockResolvedValueOnce(mockKeyRecord);
      vi.mocked(kv.hset).mockResolvedValue(1);
      vi.mocked(kv.del).mockResolvedValue(1);
      vi.mocked(kv.srem).mockResolvedValue(1);

      const result = await deleteApiKey(keyId);
      expect(result).toBe(true);
      expect(kv.hset).toHaveBeenCalledWith(
        expect.stringContaining(keyId), 
        expect.objectContaining({ status: 'revoked' })
      );
      expect(kv.del).toHaveBeenCalled();
      expect(kv.srem).toHaveBeenCalled();
    });

    it('should return false for non-existent key', async () => {
      const { kv } = await import('@vercel/kv');
      vi.mocked(kv.hgetall).mockResolvedValueOnce(null);

      const result = await deleteApiKey('non-existent-key');
      expect(result).toBe(false);
    });
  });
});