import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  validateCreateApiKeyMessage,
  validateListApiKeysMessage,
  validateDeleteApiKeyMessage,
  validateWalletAddress,
  authenticateApiKey
} from '../middleware';
import { CreateApiKeyMessage, ListApiKeysMessage, DeleteApiKeyMessage } from '../types';

// Mock the store functions
vi.mock('../store', () => ({
  validateApiKey: vi.fn(),
  logApiKeyUsage: vi.fn()
}));

describe('API Key Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateWalletAddress', () => {
    it('should validate correct Stacks address', () => {
      expect(validateWalletAddress('SP1ABC123DEF456GHI789JKL012MNO345PQR678ST')).toBe(true);
      expect(validateWalletAddress('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS')).toBe(true);
    });

    it('should reject invalid address formats', () => {
      expect(validateWalletAddress('invalid')).toBe(false);
      expect(validateWalletAddress('0x1234567890123456789012345678901234567890')).toBe(false);
      expect(validateWalletAddress('ST1ABC123DEF456GHI789JKL012MNO345PQR678ST')).toBe(false); // Wrong prefix
      expect(validateWalletAddress('')).toBe(false);
    });
  });

  describe('validateCreateApiKeyMessage', () => {
    it('should validate correct create API key message', () => {
      const message: CreateApiKeyMessage = {
        action: 'create_api_key',
        keyName: 'My Trading Bot',
        permissions: ['create', 'execute', 'cancel'],
        timestamp: Date.now()
      };
      
      expect(validateCreateApiKeyMessage(message)).toBe(true);
    });

    it('should validate message with expiration', () => {
      const future = new Date();
      future.setDate(future.getDate() + 30);
      
      const message: CreateApiKeyMessage = {
        action: 'create_api_key',
        keyName: 'Temporary Key',
        permissions: ['create'],
        timestamp: Date.now(),
        expiresAt: future.toISOString()
      };
      
      expect(validateCreateApiKeyMessage(message)).toBe(true);
    });

    it('should reject message with invalid action', () => {
      const message = {
        action: 'wrong_action',
        keyName: 'Test',
        permissions: ['execute'],
        timestamp: Date.now()
      };
      
      expect(validateCreateApiKeyMessage(message)).toBe(false);
    });

    it('should reject message with invalid key name', () => {
      const message = {
        action: 'create_api_key',
        keyName: '', // Empty name
        permissions: ['execute'],
        timestamp: Date.now()
      };
      
      expect(validateCreateApiKeyMessage(message)).toBe(false);
    });

    it('should reject message with invalid permissions', () => {
      const message = {
        action: 'create_api_key',
        keyName: 'Test',
        permissions: ['invalid_permission'],
        timestamp: Date.now()
      };
      
      expect(validateCreateApiKeyMessage(message)).toBe(false);
    });

    it('should reject message with empty permissions', () => {
      const message = {
        action: 'create_api_key',
        keyName: 'Test',
        permissions: [],
        timestamp: Date.now()
      };
      
      expect(validateCreateApiKeyMessage(message)).toBe(false);
    });

    it('should reject message with past expiration', () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);
      
      const message = {
        action: 'create_api_key',
        keyName: 'Test',
        permissions: ['execute'],
        timestamp: Date.now(),
        expiresAt: past.toISOString()
      };
      
      expect(validateCreateApiKeyMessage(message)).toBe(false);
    });
  });

  describe('validateListApiKeysMessage', () => {
    it('should validate correct list API keys message', () => {
      const message: ListApiKeysMessage = {
        action: 'list_api_keys',
        timestamp: Date.now()
      };
      
      expect(validateListApiKeysMessage(message)).toBe(true);
    });

    it('should reject message with wrong action', () => {
      const message = {
        action: 'wrong_action',
        timestamp: Date.now()
      };
      
      expect(validateListApiKeysMessage(message)).toBe(false);
    });

    it('should reject message without timestamp', () => {
      const message = {
        action: 'list_api_keys'
      };
      
      expect(validateListApiKeysMessage(message)).toBe(false);
    });
  });

  describe('validateDeleteApiKeyMessage', () => {
    it('should validate correct delete API key message', () => {
      const message: DeleteApiKeyMessage = {
        action: 'delete_api_key',
        keyId: 'key-123abc',
        timestamp: Date.now()
      };
      
      expect(validateDeleteApiKeyMessage(message)).toBe(true);
    });

    it('should reject message with wrong action', () => {
      const message = {
        action: 'wrong_action',
        keyId: 'key-123',
        timestamp: Date.now()
      };
      
      expect(validateDeleteApiKeyMessage(message)).toBe(false);
    });

    it('should reject message without keyId', () => {
      const message = {
        action: 'delete_api_key',
        timestamp: Date.now()
      };
      
      expect(validateDeleteApiKeyMessage(message)).toBe(false);
    });
  });

  describe('authenticateApiKey', () => {
    it('should authenticate valid API key', async () => {
      const mockRequest = new NextRequest('https://example.com/api/test', {
        headers: {
          'x-api-key': 'ck_live_test123'
        }
      });

      const { validateApiKey } = await import('../store');
      vi.mocked(validateApiKey).mockResolvedValue({
        valid: true,
        keyRecord: {
          id: 'key-123',
          keyHash: 'hash123',
          keyPreview: 'sk_test_****',
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
        },
        rateLimitInfo: {
          limit: 100,
          remaining: 99,
          reset: Math.floor(Date.now() / 1000) + 60,
          window: 60
        }
      });

      const result = await authenticateApiKey(
        mockRequest,
        'SP1ABC123DEF456',
        'execute'
      );

      expect(result.success).toBe(true);
      expect(result.keyId).toBe('key-123');
      expect(result.rateLimitHeaders).toBeDefined();
    });

    it('should reject request without API key', async () => {
      const mockRequest = new NextRequest('https://example.com/api/test');

      const result = await authenticateApiKey(
        mockRequest,
        'SP1ABC123DEF456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('API key required');
    });

    it('should reject invalid API key', async () => {
      const mockRequest = new NextRequest('https://example.com/api/test', {
        headers: {
          'x-api-key': 'invalid-key'
        }
      });

      const { validateApiKey } = await import('../store');
      vi.mocked(validateApiKey).mockResolvedValue({
        valid: false,
        error: 'INVALID_API_KEY'
      });

      const result = await authenticateApiKey(
        mockRequest,
        'SP1ABC123DEF456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_API_KEY');
    });

    it('should handle rate limit exceeded', async () => {
      const mockRequest = new NextRequest('https://example.com/api/test', {
        headers: {
          'x-api-key': 'ck_live_test123'
        }
      });

      const { validateApiKey } = await import('../store');
      vi.mocked(validateApiKey).mockResolvedValue({
        valid: false,
        error: 'RATE_LIMIT_EXCEEDED',
        keyRecord: {
          id: 'key-123',
          keyHash: 'hash123',
          keyPreview: 'sk_test_****',
          walletAddress: 'SP1ABC123DEF456',
          name: 'Test Key',
          permissions: ['execute'],
          status: 'active',
          rateLimit: 100,
          createdAt: new Date().toISOString(),
          usageStats: {
            totalRequests: 100,
            successfulRequests: 95,
            failedRequests: 5,
            creationCount: 35,
            executionCount: 50,
            cancellationCount: 10
          }
        },
        rateLimitInfo: {
          limit: 100,
          remaining: 0,
          reset: Math.floor(Date.now() / 1000) + 60,
          window: 60
        }
      });

      const result = await authenticateApiKey(
        mockRequest,
        'SP1ABC123DEF456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(result.rateLimitHeaders).toBeDefined();
      expect(result.rateLimitHeaders!['X-RateLimit-Remaining']).toBe('0');
    });

    it('should authenticate API key with create permission', async () => {
      const mockRequest = new NextRequest('https://example.com/api/test', {
        headers: {
          'x-api-key': 'ck_live_test123'
        }
      });

      const { validateApiKey } = await import('../store');
      vi.mocked(validateApiKey).mockResolvedValue({
        valid: true,
        keyRecord: {
          id: 'key-456',
          keyHash: 'hash456',
          keyPreview: 'sk_test_****',
          walletAddress: 'SP1ABC123DEF456',
          name: 'Creation Bot',
          permissions: ['create', 'execute'],
          status: 'active',
          rateLimit: 100,
          createdAt: new Date().toISOString(),
          usageStats: {
            totalRequests: 50,
            successfulRequests: 48,
            failedRequests: 2,
            creationCount: 30,
            executionCount: 18,
            cancellationCount: 0
          }
        },
        rateLimitInfo: {
          limit: 100,
          remaining: 75,
          reset: Math.floor(Date.now() / 1000) + 60,
          window: 60
        }
      });

      const result = await authenticateApiKey(
        mockRequest,
        'SP1ABC123DEF456',
        'create'
      );

      expect(result.success).toBe(true);
      expect(result.keyId).toBe('key-456');
      expect(result.rateLimitHeaders).toBeDefined();
      expect(result.rateLimitHeaders!['X-RateLimit-Remaining']).toBe('75');
    });
  });
});