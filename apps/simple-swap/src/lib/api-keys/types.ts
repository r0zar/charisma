export type ApiKeyPermission = 'create' | 'execute' | 'cancel';
export type ApiKeyStatus = 'active' | 'suspended' | 'revoked';

export interface ApiKey {
  id: string;
  keyHash: string; // hashed API key for security
  keyPreview: string; // masked preview (first 8 + ... + last 4 chars)
  walletAddress: string; // Stacks address that owns this key
  name: string; // user-friendly name for the key
  permissions: ApiKeyPermission[];
  rateLimit: number; // requests per minute
  status: ApiKeyStatus;
  createdAt: string; // ISO timestamp
  lastUsedAt?: string; // ISO timestamp
  expiresAt?: string; // ISO timestamp (optional expiration)
  usageStats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    creationCount: number;
    executionCount: number;
    cancellationCount: number;
  };
}

export interface CreateApiKeyRequest {
  message: string; // JSON stringified message that was signed
  signature: string; // hex signature from wallet
  walletAddress: string; // Stacks address
}

export interface CreateApiKeyMessage {
  action: 'create_api_key';
  keyName: string;
  permissions: ApiKeyPermission[];
  timestamp: number;
  expiresAt?: string; // optional expiration date
}

export interface ListApiKeysRequest {
  message: string; // JSON stringified message that was signed
  signature: string; // hex signature from wallet
  walletAddress: string; // Stacks address
}

export interface ListApiKeysMessage {
  action: 'list_api_keys';
  timestamp: number;
}

export interface DeleteApiKeyRequest {
  message: string; // JSON stringified message that was signed
  signature: string; // hex signature from wallet
  walletAddress: string; // Stacks address
}

export interface DeleteApiKeyMessage {
  action: 'delete_api_key';
  keyId: string;
  timestamp: number;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  keyRecord?: ApiKey;
  error?: string;
}

export interface ApiKeyUsageRecord {
  keyId: string;
  timestamp: string;
  endpoint: string;
  method: string;
  success: boolean;
  errorMessage?: string;
  responseTime?: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when limit resets
  window: number; // Window size in seconds
}

export interface ApiKeyStats {
  keyId: string;
  walletAddress: string;
  name: string;
  status: ApiKeyStatus;
  permissions: ApiKeyPermission[];
  rateLimit: number;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  usageStats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    creationCount: number;
    executionCount: number;
    cancellationCount: number;
  };
  recentActivity?: ApiKeyUsageRecord[];
}

// Response types
export interface CreateApiKeyResponse {
  status: 'success';
  apiKey: string; // The actual API key (only returned once)
  keyId: string;
  name: string;
  permissions: ApiKeyPermission[];
  rateLimit: number;
  expiresAt?: string;
}

export interface ListApiKeysResponse {
  status: 'success';
  apiKeys: Omit<ApiKey, 'keyHash'>[]; // Never return the hashed key, but include keyPreview
}

export interface DeleteApiKeyResponse {
  status: 'success';
  message: string;
}

export interface ApiKeyErrorResponse {
  error: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Constants
export const DEFAULT_RATE_LIMIT = 100; // requests per minute
export const DEFAULT_DAILY_LIMIT = 10000; // requests per day
export const API_KEY_PREFIX = 'ck_live_';
export const API_KEY_LENGTH = 64; // characters after prefix

// Validation schemas as types (for runtime validation)
export interface ApiKeyValidationRules {
  name: {
    minLength: number;
    maxLength: number;
    pattern: RegExp;
  };
  permissions: {
    allowedValues: ApiKeyPermission[];
    minCount: number;
    maxCount: number;
  };
  rateLimit: {
    min: number;
    max: number;
  };
  signature: {
    length: number;
    pattern: RegExp;
  };
  walletAddress: {
    pattern: RegExp;
  };
}

export const VALIDATION_RULES: ApiKeyValidationRules = {
  name: {
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-_]+$/
  },
  permissions: {
    allowedValues: ['create', 'execute', 'cancel'],
    minCount: 1,
    maxCount: 3
  },
  rateLimit: {
    min: 10,
    max: 1000
  },
  signature: {
    length: 130, // 65 bytes in hex
    pattern: /^[0-9a-fA-F]{130}$/
  },
  walletAddress: {
    pattern: /^SP[0-9A-Z]{39}$/
  }
};

// Error codes
export enum ApiKeyErrorCode {
  INVALID_API_KEY = 'INVALID_API_KEY',
  API_KEY_INACTIVE = 'API_KEY_INACTIVE',
  UNAUTHORIZED_WALLET = 'UNAUTHORIZED_WALLET',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  EXPIRED_TIMESTAMP = 'EXPIRED_TIMESTAMP',
  DUPLICATE_KEY_NAME = 'DUPLICATE_KEY_NAME',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  KEY_NOT_FOUND = 'KEY_NOT_FOUND'
}