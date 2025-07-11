/**
 * DataLoader - Elegant single-responsibility data loading class
 * Combines configuration and loading logic for clean API
 */

import { appState } from '@/data/app-state';
import { type AppState, AppStateSchema } from '@/schemas/app-state.schema';
import {
  ENABLE_API_METADATA,
  ENABLE_API_USER,
  ENABLE_API_BOTS,
  ENABLE_API_NOTIFICATIONS,
  API_BASE_URL,
  API_TIMEOUT,
  DEFAULT_USER_ID,
  NEXTAUTH_URL,
  CACHE_ENABLED,
  CACHE_TTL,
  DEBUG_DATA_LOADING,
  LOG_DATA_SOURCES
} from '@/lib/utils/config';

// Data source types for each app state segment
export type DataSource = 'static' | 'api';

// Configuration for each app state segment
export interface DataSourceConfig {
  metadata: DataSource;
  user: DataSource;
  bots: DataSource;
  notifications: DataSource;
  apiBaseUrl: string;
  apiTimeout: number;
  defaultUserId: string;
  nextAuthUrl?: string;
  cacheEnabled: boolean;
  cacheTtl: number; // Cache TTL in seconds
  debugDataLoading: boolean;
  logDataSources: boolean;
}


/**
 * DataLoader - Single responsibility class for loading app data
 * Encapsulates both configuration and loading logic
 */
class DataLoader {
  private config: DataSourceConfig;

  constructor() {
    this.config = this.buildConfig();
  }

  /**
   * Build data source configuration from constants
   */
  private buildConfig(): DataSourceConfig {
    return {
      // Data sources based on feature flags
      metadata: this.getDataSource(ENABLE_API_METADATA),
      user: this.getDataSource(ENABLE_API_USER),
      bots: this.getDataSource(ENABLE_API_BOTS),
      notifications: this.getDataSource(ENABLE_API_NOTIFICATIONS),

      // API configuration
      apiBaseUrl: API_BASE_URL,
      apiTimeout: API_TIMEOUT,
      defaultUserId: DEFAULT_USER_ID,
      nextAuthUrl: NEXTAUTH_URL,

      // Cache configuration
      cacheEnabled: CACHE_ENABLED,
      cacheTtl: CACHE_TTL,

      // Debug configuration
      debugDataLoading: DEBUG_DATA_LOADING,
      logDataSources: LOG_DATA_SOURCES,
    };
  }

  /**
   * Convert feature flag boolean to data source type
   */
  private getDataSource(isApiEnabled: boolean): DataSource {
    return isApiEnabled ? 'api' : 'static';
  }

  /**
   * Get the current data source configuration
   */
  getConfig(): DataSourceConfig {
    return this.config;
  }

  /**
   * Check if a specific data source is configured for API
   */
  isApiEnabled(segment: keyof Pick<DataSourceConfig, 'metadata' | 'user' | 'bots' | 'notifications'>): boolean {
    return this.config[segment] === 'api';
  }

  /**
   * Load metadata from appropriate source based on feature flags
   */
  loadMetadata(): AppState['metadata'] {
    if (this.config.metadata === 'api') {
      // TODO: Implement API loading when metadata API is enabled
      // For now, return static metadata as fallback
      return appState.metadata;
    } else {
      // Load from static data
      return appState.metadata;
    }
  }

  /**
   * Load user data from appropriate source based on feature flags
   */
  loadUser(): AppState['user'] {
    if (this.config.user === 'api') {
      // TODO: Implement API loading when user API is enabled
      // For now, return static data as fallback
      return appState.user;
    } else {
      // Load from static data
      return appState.user;
    }
  }

  /**
   * Load bots data from appropriate source based on feature flags
   */
  loadBots(): AppState['bots'] {
    if (this.config.bots === 'api') {
      // TODO: Implement API loading when bots API is enabled
      // For now, return static data as fallback
      return appState.bots;
    } else {
      // Load from static data
      return appState.bots;
    }
  }

  /**
   * Load notifications data from appropriate source based on feature flags
   */
  loadNotifications(): AppState['notifications'] {
    if (this.config.notifications === 'api') {
      // TODO: Implement API loading when notifications API is enabled
      // For now, return static data as fallback
      return appState.notifications;
    } else {
      // Load from static data
      return appState.notifications;
    }
  }

  /**
   * Universal app state loader that respects feature flags
   * This is the single source of truth for loading app state consistently
   * across server-side environments (layout, API routes, cron jobs, etc.)
   */
  loadAppState(): AppState {
    try {
      // Load each segment from appropriate source
      const metadata = this.loadMetadata();
      const user = this.loadUser();
      const bots = this.loadBots();
      const notifications = this.loadNotifications();

      // Assemble the complete app state
      const assembledState: AppState = {
        metadata,
        user,
        bots,
        notifications,
      };

      // Validate with Zod schema
      const validationResult = AppStateSchema.safeParse(assembledState);

      if (!validationResult.success) {
        const validationErrors = validationResult.error.issues.map(issue =>
          `${issue.path.join('.')}: ${issue.message}`
        );
        throw new Error(`Data validation failed: ${validationErrors.join(', ')}`);
      }

      return validationResult.data;
    } catch (error) {
      throw new Error(`Failed to load app state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate data source configuration
   */
  validateConfig(): string[] {
    const errors: string[] = [];

    // Check required fields
    const requiredFields: (keyof DataSourceConfig)[] = ['metadata', 'user', 'bots', 'notifications'];
    for (const field of requiredFields) {
      if (!this.config[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate data sources
    const validSources: DataSource[] = ['static', 'api'];
    for (const field of requiredFields) {
      const value = this.config[field];
      if (value && !validSources.includes(value as DataSource)) {
        errors.push(`Invalid data source for ${field}: ${value}`);
      }
    }

    // Validate API base URL when API sources are used
    const hasApiSources = requiredFields.some(field =>
      this.config[field] === 'api'
    );
    if (hasApiSources && !this.config.apiBaseUrl) {
      errors.push('apiBaseUrl is required when using API data sources');
    }

    // Validate cache TTL
    if (this.config.cacheTtl <= 0) {
      errors.push('cacheTtl must be a positive number');
    }

    // Validate API timeout
    if (this.config.apiTimeout <= 0) {
      errors.push('apiTimeout must be a positive number');
    }

    return errors;
  }

}

// Export singleton instance for easy use across the app
export const dataLoader = new DataLoader();

