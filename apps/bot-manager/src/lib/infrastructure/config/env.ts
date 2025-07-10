/**
 * Environment Configuration Management
 * Provides typed access to environment variables for data loading
 */

export interface EnvConfig {
  // Data loading configuration
  loadingConfig?: string;
  
  // API configuration
  apiBaseUrl: string;
  apiTimeout: number;
  
  // Cache configuration
  cacheEnabled: boolean;
  cacheTtl: number;
  
  // Debug configuration
  debugDataLoading: boolean;
  logDataSources: boolean;
  
  // Feature flags
  enableApiMetadata: boolean;
  enableApiUser: boolean;
  enableApiBots: boolean;
  enableApiMarket: boolean;
  enableApiNotifications: boolean;
}

/**
 * Get environment configuration with defaults
 */
export function getEnvConfig(): EnvConfig {
  return {
    // Data loading configuration
    loadingConfig: process.env.NEXT_PUBLIC_LOADING_CONFIG,
    
    // API configuration
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1',
    apiTimeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '5000'),
    
    // Cache configuration
    cacheEnabled: process.env.NEXT_PUBLIC_CACHE_ENABLED === 'true',
    cacheTtl: parseInt(process.env.NEXT_PUBLIC_CACHE_TTL || '300'),
    
    // Debug configuration
    debugDataLoading: process.env.NEXT_PUBLIC_DEBUG_DATA_LOADING === 'true',
    logDataSources: process.env.NEXT_PUBLIC_LOG_DATA_SOURCES === 'true',
    
    // Feature flags
    enableApiMetadata: process.env.NEXT_PUBLIC_ENABLE_API_METADATA === 'true',
    enableApiUser: process.env.NEXT_PUBLIC_ENABLE_API_USER === 'true',
    enableApiBots: process.env.NEXT_PUBLIC_ENABLE_API_BOTS === 'true',
    enableApiMarket: process.env.NEXT_PUBLIC_ENABLE_API_MARKET === 'true',
    enableApiNotifications: process.env.NEXT_PUBLIC_ENABLE_API_NOTIFICATIONS === 'true',
  };
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof Pick<EnvConfig, 'enableApiMetadata' | 'enableApiUser' | 'enableApiBots' | 'enableApiMarket' | 'enableApiNotifications'>): boolean {
  const config = getEnvConfig();
  return config[feature];
}

/**
 * Get current environment (development, staging, production)
 */
export function getCurrentEnvironment(): 'development' | 'staging' | 'production' {
  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;
  
  if (nodeEnv === 'production' && vercelEnv === 'production') {
    return 'production';
  } else if (nodeEnv === 'production' && vercelEnv === 'preview') {
    return 'staging';
  } else {
    return 'development';
  }
}

/**
 * Check if we're in a server environment
 */
export function isServerSide(): boolean {
  return typeof window === 'undefined';
}

/**
 * Check if we're in a client environment
 */
export function isClientSide(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get debug information about current configuration
 */
export function getDebugInfo(): Record<string, any> {
  const config = getEnvConfig();
  const env = getCurrentEnvironment();
  
  return {
    environment: env,
    loadingConfig: config.loadingConfig,
    apiBaseUrl: config.apiBaseUrl,
    cacheEnabled: config.cacheEnabled,
    featureFlags: {
      apiMetadata: config.enableApiMetadata,
      apiUser: config.enableApiUser,
      apiBots: config.enableApiBots,
      apiMarket: config.enableApiMarket,
      apiNotifications: config.enableApiNotifications,
    },
    isServer: isServerSide(),
    isClient: isClientSide(),
    timestamp: new Date().toISOString(),
  };
}

// Log configuration on import in development
if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_DATA_LOADING === 'true') {
  console.log('📊 Data Loading Configuration:', getDebugInfo());
}