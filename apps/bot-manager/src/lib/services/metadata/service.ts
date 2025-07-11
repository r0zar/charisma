/**
 * MetadataService - Controller layer for app metadata and system information
 * Handles configuration and environment information
 */

import { 
  API_BASE_URL, 
  API_TIMEOUT, 
  CACHE_ENABLED, 
  CACHE_TTL, 
  DEBUG_DATA_LOADING, 
  ENABLE_API_BOTS, 
  ENABLE_API_METADATA, 
  ENABLE_API_NOTIFICATIONS, 
  ENABLE_API_USER, 
  LOG_DATA_SOURCES, 
  NODE_ENV 
} from '@/lib/utils/config';
import { AppMetadata } from '@/schemas/app-metadata.schema';

export interface FeatureFlags {
  enableApiMetadata: boolean;
  enableApiUser: boolean;
  enableApiBots: boolean;
  enableApiMarket: boolean;
  enableApiNotifications: boolean;
}

export interface EnvironmentInfo {
  environment: 'development' | 'staging' | 'production';
  nodeEnv: string;
  isServer: boolean;
  isClient: boolean;
  timestamp: string;
}

export interface SystemConfig {
  apiBaseUrl: string;
  apiTimeout: number;
  cacheEnabled: boolean;
  cacheTtl: number;
  debugDataLoading: boolean;
  logDataSources: boolean;
}

export class MetadataService {
  
  /**
   * Get complete app metadata
   */
  getAppMetadata(): AppMetadata {
    const isServer = typeof window === 'undefined';
    const isClient = typeof window !== 'undefined';
    
    return {
      environment: (NODE_ENV as 'development' | 'staging' | 'production') || 'development',
      loadingConfig: this.getLoadingConfig(),
      apiBaseUrl: API_BASE_URL,
      apiTimeout: API_TIMEOUT,
      cacheEnabled: CACHE_ENABLED,
      cacheTtl: CACHE_TTL,
      debugDataLoading: DEBUG_DATA_LOADING,
      logDataSources: LOG_DATA_SOURCES,
      featureFlags: this.getFeatureFlags(),
      isServer,
      isClient,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get current feature flags
   */
  getFeatureFlags(): FeatureFlags {
    return {
      enableApiMetadata: ENABLE_API_METADATA,
      enableApiUser: ENABLE_API_USER,
      enableApiBots: ENABLE_API_BOTS,
      enableApiMarket: false, // Market API not implemented
      enableApiNotifications: ENABLE_API_NOTIFICATIONS,
    };
  }

  /**
   * Get environment information
   */
  getEnvironmentInfo(): EnvironmentInfo {
    return {
      environment: (NODE_ENV as 'development' | 'staging' | 'production') || 'development',
      nodeEnv: NODE_ENV,
      isServer: typeof window === 'undefined',
      isClient: typeof window !== 'undefined',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get system configuration
   */
  getSystemConfig(): SystemConfig {
    return {
      apiBaseUrl: API_BASE_URL,
      apiTimeout: API_TIMEOUT,
      cacheEnabled: CACHE_ENABLED,
      cacheTtl: CACHE_TTL,
      debugDataLoading: DEBUG_DATA_LOADING,
      logDataSources: LOG_DATA_SOURCES,
    };
  }

  /**
   * Get loading configuration summary
   */
  getLoadingConfig(): string {
    const flags = this.getFeatureFlags();
    const enabledApis = Object.entries(flags)
      .filter(([_, enabled]) => enabled)
      .map(([key, _]) => key);
    
    if (enabledApis.length === 0) {
      return 'static';
    } else if (enabledApis.length === Object.keys(flags).length) {
      return 'api';
    } else {
      return 'mixed';
    }
  }

  /**
   * Check if specific API is enabled
   */
  isApiEnabled(apiName: keyof FeatureFlags): boolean {
    const flags = this.getFeatureFlags();
    return flags[apiName];
  }

  /**
   * Get data source for specific domain
   */
  getDataSource(domain: 'metadata' | 'user' | 'bots' | 'notifications'): 'api' | 'static' {
    switch (domain) {
      case 'metadata':
        return ENABLE_API_METADATA ? 'api' : 'static';
      case 'user':
        return ENABLE_API_USER ? 'api' : 'static';
      case 'bots':
        return ENABLE_API_BOTS ? 'api' : 'static';
      case 'notifications':
        return ENABLE_API_NOTIFICATIONS ? 'api' : 'static';
      default:
        return 'static';
    }
  }

  /**
   * Get development/debug information
   */
  getDebugInfo(): {
    debugDataLoading: boolean;
    logDataSources: boolean;
    cacheEnabled: boolean;
    environment: string;
    dataSources: Record<string, 'api' | 'static'>;
  } {
    return {
      debugDataLoading: DEBUG_DATA_LOADING,
      logDataSources: LOG_DATA_SOURCES,
      cacheEnabled: CACHE_ENABLED,
      environment: NODE_ENV,
      dataSources: {
        metadata: this.getDataSource('metadata'),
        user: this.getDataSource('user'),
        bots: this.getDataSource('bots'),
        notifications: this.getDataSource('notifications'),
      },
    };
  }

  /**
   * Get system health check information
   */
  getSystemHealth(): {
    status: 'healthy' | 'warning' | 'error';
    services: Record<string, { status: string; dataSource: string }>;
    timestamp: string;
  } {
    const featureFlags = this.getFeatureFlags();
    const services: Record<string, { status: string; dataSource: string }> = {};
    
    // Check each service
    services.metadata = {
      status: 'healthy',
      dataSource: this.getDataSource('metadata'),
    };
    
    services.user = {
      status: featureFlags.enableApiUser ? 'healthy' : 'static',
      dataSource: this.getDataSource('user'),
    };
    
    services.bots = {
      status: featureFlags.enableApiBots ? 'healthy' : 'static',
      dataSource: this.getDataSource('bots'),
    };
    
    services.notifications = {
      status: featureFlags.enableApiNotifications ? 'healthy' : 'static',
      dataSource: this.getDataSource('notifications'),
    };
    
    // Determine overall status
    const hasErrors = Object.values(services).some(s => s.status === 'error');
    const hasWarnings = Object.values(services).some(s => s.status === 'warning');
    const status = hasErrors ? 'error' : hasWarnings ? 'warning' : 'healthy';
    
    return {
      status,
      services,
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const metadataService = new MetadataService();