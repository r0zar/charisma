import { type AppMetadata } from '@/schemas/app-metadata.schema';
import { getEnvConfig, getCurrentEnvironment, isServerSide, isClientSide } from '@/lib/infrastructure/config/env';

/**
 * Live application metadata based on environment configuration
 * No longer static - dynamically generated from environment
 */
export function getMetadataData(): AppMetadata {
  const envConfig = getEnvConfig();
  const environment = getCurrentEnvironment();
  
  return {
    // Environment information
    environment,
    
    // Data loading configuration
    loadingConfig: envConfig.loadingConfig,
    
    // API configuration
    apiBaseUrl: envConfig.apiBaseUrl,
    apiTimeout: envConfig.apiTimeout,
    
    // Cache configuration
    cacheEnabled: envConfig.cacheEnabled,
    cacheTtl: envConfig.cacheTtl,
    
    // Debug configuration
    debugDataLoading: envConfig.debugDataLoading,
    logDataSources: envConfig.logDataSources,
    
    // Feature flags
    featureFlags: {
      enableApiMetadata: envConfig.enableApiMetadata,
      enableApiUser: envConfig.enableApiUser,
      enableApiBots: envConfig.enableApiBots,
      enableApiMarket: envConfig.enableApiMarket,
      enableApiNotifications: envConfig.enableApiNotifications,
    },
    
    // Runtime information
    isServer: isServerSide(),
    isClient: isClientSide(),
    timestamp: new Date().toISOString(),
  };
}