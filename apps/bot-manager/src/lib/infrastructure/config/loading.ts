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
  notifications: DataSource;
  apiBaseUrl?: string;
  cacheEnabled?: boolean;
  cacheTtl?: number; // Cache TTL in seconds
}

// Get data source based on feature flag
function getDataSource(featureFlag: boolean): DataSource {
  return featureFlag ? 'api' : 'static';
}

// Get configuration based on feature flags
export function getLoadingConfig(): LoadingConfig {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';
  const cacheEnabled = process.env.NEXT_PUBLIC_CACHE_ENABLED === 'true';
  const cacheTtl = parseInt(process.env.NEXT_PUBLIC_CACHE_TTL || '300');

  // Use feature flags to determine data sources
  return {
    metadata: getDataSource(process.env.NEXT_PUBLIC_ENABLE_API_METADATA === 'true'),
    user: getDataSource(process.env.NEXT_PUBLIC_ENABLE_API_USER === 'true'),
    bots: getDataSource(process.env.NEXT_PUBLIC_ENABLE_API_BOTS === 'true'),
    notifications: getDataSource(process.env.NEXT_PUBLIC_ENABLE_API_NOTIFICATIONS === 'true'),
    apiBaseUrl,
    cacheEnabled,
    cacheTtl,
  };
}

// Validate configuration
export function validateConfig(config: LoadingConfig): string[] {
  const errors: string[] = [];

  // Check required fields
  const requiredFields: (keyof LoadingConfig)[] = ['metadata', 'user', 'bots', 'notifications'];
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
export function isApiEnabled(config: LoadingConfig, segment: keyof Pick<LoadingConfig, 'metadata' | 'user' | 'bots' | 'notifications'>): boolean {
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