/**
 * Configuration System for Incremental API Migration
 * Supports mixing static data sources with API endpoints
 */

// Data source types for each app state segment
export type DataSource = 'static' | 'api';

// Configuration for each app state segment
export interface LoadingConfig {
  metadata: DataSource;
  user: DataSource;
  bots: DataSource;
  market: DataSource;
  notifications: DataSource;
  apiBaseUrl?: string;
  cacheEnabled?: boolean;
  cacheTtl?: number; // Cache TTL in seconds
}

// Default configurations for different environments
export const DEFAULT_CONFIGS: Record<string, LoadingConfig> = {
  // Development - all static for fast iteration
  development: {
    metadata: 'static',
    user: 'static',
    bots: 'static',
    market: 'static',
    notifications: 'static',
    apiBaseUrl: '/api/v1',
    cacheEnabled: false,
  },

  // Phase 1 - Start with notifications only
  phase1: {
    metadata: 'api',
    user: 'static',
    bots: 'static',
    market: 'static',
    notifications: 'api',
    apiBaseUrl: '/api/v1',
    cacheEnabled: true,
    cacheTtl: 300, // 5 minutes
  },

  // Phase 2 - Add market data  
  phase2: {
    metadata: 'api',
    user: 'static',
    bots: 'static',
    market: 'api',
    notifications: 'api',
    apiBaseUrl: '/api/v1',
    cacheEnabled: true,
    cacheTtl: 300,
  },

  // Phase 3 - Add user data
  phase3: {
    metadata: 'api',
    user: 'api',
    bots: 'static',
    market: 'api',
    notifications: 'api',
    apiBaseUrl: '/api/v1',
    cacheEnabled: true,
    cacheTtl: 300,
  },

  // Phase 4 - Add bots data
  phase4: {
    metadata: 'api',
    user: 'api',
    bots: 'api',
    market: 'api',
    notifications: 'api',
    apiBaseUrl: '/api/v1',
    cacheEnabled: true,
    cacheTtl: 300,
  },

  // Production - all API
  production: {
    metadata: 'api',
    user: 'api',
    bots: 'api',
    market: 'api',
    notifications: 'api',
    apiBaseUrl: '/api/v1',
    cacheEnabled: true,
    cacheTtl: 300,
  },

  // Testing - API only to catch API issues
  testing: {
    metadata: 'api',
    user: 'api',
    bots: 'api',
    market: 'api',
    notifications: 'api',
    apiBaseUrl: '/api/v1',
    cacheEnabled: false,
  },
};

// Get configuration based on environment
export function getLoadingConfig(): LoadingConfig {
  const env = process.env.NODE_ENV;
  const phase = process.env.NEXT_PUBLIC_DATA_PHASE || 'development';
  
  // Allow override via environment variable
  const configKey = process.env.NEXT_PUBLIC_LOADING_CONFIG || phase;
  
  return DEFAULT_CONFIGS[configKey] || DEFAULT_CONFIGS.development;
}

// Validate configuration
export function validateConfig(config: LoadingConfig): string[] {
  const errors: string[] = [];

  // Check required fields
  const requiredFields: (keyof LoadingConfig)[] = ['metadata', 'user', 'bots', 'market', 'notifications'];
  for (const field of requiredFields) {
    if (!config[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate data sources
  const validSources: DataSource[] = ['static', 'api'];
  for (const field of requiredFields) {
    const value = config[field];
    if (value && !validSources.includes(value as DataSource)) {
      errors.push(`Invalid data source for ${field}: ${value}`);
    }
  }

  // Validate API base URL when API sources are used
  const hasApiSources = requiredFields.some(field => 
    config[field] === 'api'
  );
  if (hasApiSources && !config.apiBaseUrl) {
    errors.push('apiBaseUrl is required when using API data sources');
  }

  // Validate cache TTL
  if (config.cacheTtl !== undefined && config.cacheTtl <= 0) {
    errors.push('cacheTtl must be a positive number');
  }

  return errors;
}

// Helper to check if a specific data source is configured for API
export function isApiEnabled(config: LoadingConfig, segment: keyof Pick<LoadingConfig, 'metadata' | 'user' | 'bots' | 'market' | 'notifications'>): boolean {
  return config[segment] === 'api';
}


// Current runtime configuration based on environment
export const config = {
  // Data loading configuration
  loading: getLoadingConfig(),
  
  // Feature flags for incremental API rollout
  enableAPINotifications: process.env.NEXT_PUBLIC_ENABLE_API_NOTIFICATIONS === 'true',
  enableAPIMetadata: process.env.NEXT_PUBLIC_ENABLE_API_METADATA === 'true',
  enableAPIUser: process.env.NEXT_PUBLIC_ENABLE_API_USER === 'true',
  enableAPIMarket: process.env.NEXT_PUBLIC_ENABLE_API_MARKET === 'true',
  enableAPIBots: process.env.NEXT_PUBLIC_ENABLE_API_BOTS === 'true',
  
  // API configuration
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1',
  defaultUserId: process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'default-user',
  
  // Cache configuration
  enableCaching: process.env.NEXT_PUBLIC_ENABLE_CACHING !== 'false',
  cacheTtl: parseInt(process.env.NEXT_PUBLIC_CACHE_TTL || '300'), // 5 minutes default
  
  // Development configuration
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Debug configuration
  enableDebugLogging: process.env.NEXT_PUBLIC_DEBUG_LOGGING === 'true',
};