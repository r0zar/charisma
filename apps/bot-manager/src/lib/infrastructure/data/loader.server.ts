import { promises as fs } from 'fs';
import path from 'path';

import { appState } from '@/data/app-state';
import { defaultState } from '@/data/default-state';
import { type AppState } from '@/schemas/app-state.schema';
import { AppStateSchema } from '@/schemas/app-state.schema';

import {apiClient } from '../api/client';
import { getLoadingConfig, type LoadingConfig, validateConfig } from '../config/loading';

/**
 * Server-side Data Loading Operations
 * Handles data loading with filesystem/network access and Node.js APIs
 * This file should only be imported in server-side contexts
 */

/**
 * Load and validate app state from TypeScript import
 * @param useDefault - Whether to use default state instead of main state
 * @returns Promise<AppState>
 * @throws Error if validation fails
 */
export async function loadAppState(useDefault = false): Promise<AppState> {
  try {
    // Get the data from TypeScript import
    const rawData = useDefault ? defaultState : appState;

    // Validate with Zod schema
    const validationResult = AppStateSchema.safeParse(rawData);

    if (!validationResult.success) {
      const validationErrors = validationResult.error.issues.map(issue =>
        `${issue.path.join('.')}: ${issue.message}`
      );
      throw new Error(`Data validation failed: ${validationErrors.join(', ')}`);
    }

    return validationResult.data;
  } catch (error) {
    throw new Error(`Failed to load data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Load default state as fallback
 * @returns Promise<AppState>
 */
export async function loadDefaultState(): Promise<AppState> {
  return loadAppState(true);
}

/**
 * Load app state with automatic fallback to default
 * @returns Promise<AppState>
 * @throws Error if both main and default states fail to load
 */
export async function loadAppStateWithFallback(): Promise<AppState> {
  // Try to load main state first
  try {
    return await loadAppState();
  } catch (mainError) {
    // Log the main state error
    console.warn('Failed to load main app state:', mainError instanceof Error ? mainError.message : mainError);

    // Try to load default state
    try {
      console.info('Loading default app state as fallback');
      return await loadDefaultState();
    } catch (defaultError) {
      // Both failed, throw error
      throw new Error(
        `Failed to load app state: ${mainError instanceof Error ? mainError.message : mainError}. Default state also failed: ${defaultError instanceof Error ? defaultError.message : defaultError}`
      );
    }
  }
}

/**
 * Validate state from file path or URL (server-only)
 * @param filePath - Local file path or HTTP URL to validate
 * @returns Promise<AppState>
 * @throws Error if validation fails
 */
export async function validateStateFile(filePath: string): Promise<AppState> {
  try {
    let data: any;

    // Check if this is a local file path or URL
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      // Use fetch for URLs
      const response = await fetch(filePath);

      if (!response.ok) {
        throw new Error(`Failed to load state from ${filePath}: ${response.status} ${response.statusText}`);
      }

      data = await response.json();
    } else {
      // Use fs for local files (Node.js environment)
      try {
        // Resolve relative paths
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

        const fileContent = await fs.readFile(resolvedPath, 'utf-8');

        // Handle both JSON and TypeScript files
        if (filePath.endsWith('.ts')) {
          // For TypeScript files, we'd need to dynamically import
          // For now, assume they export as JSON-like structure
          throw new Error(`TypeScript file validation not yet supported: ${filePath}`);
        } else {
          data = JSON.parse(fileContent);
        }
      } catch (fileError) {
        throw new Error(`Failed to read file ${filePath}: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
      }
    }

    // Validate with Zod schema
    const validationResult = AppStateSchema.safeParse(data);

    if (!validationResult.success) {
      const validationErrors = validationResult.error.issues.map(issue =>
        `${issue.path.join('.')}: ${issue.message}`
      );
      throw new Error(`Data validation failed: ${validationErrors.join(', ')}`);
    }

    return validationResult.data;
  } catch (error) {
    throw new Error(`Failed to parse state from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if current environment supports server-side operations
 * @returns boolean indicating if server-side APIs are available
 */
export function isServerEnvironment(): boolean {
  try {
    return typeof process !== 'undefined' &&
      typeof process.cwd === 'function' &&
      typeof fs !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Load app state data segment from specified source
 * @param segment - The data segment to load
 * @param source - The data source to use
 * @param useDefault - Whether to use default state for static loading
 * @returns Promise<DataSegmentResult>
 */
async function loadDataSegment(
  segment: keyof Pick<AppState, 'metadata' | 'user' | 'bots' | 'notifications'>,
  source: 'static' | 'api',
  useDefault = false
): Promise<{ success: boolean; data?: any; error?: string; warnings?: string[] }> {
  if (source === 'static') {
    const sourceData = useDefault ? defaultState : appState;
    return {
      success: true,
      data: sourceData[segment],
    };
  }

  if (source === 'api') {
    try {
      switch (segment) {
        case 'metadata':
          return await apiClient.fetchMetadata(useDefault);
        case 'user':
          return await apiClient.fetchUser(useDefault);
        case 'bots':
          return await apiClient.fetchBots({ useDefault });
        // Market case removed
        case 'notifications':
          return await apiClient.fetchNotifications({ useDefault });
        default:
          return {
            success: false,
            error: `Unknown segment: ${segment}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `API error for ${segment}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  return {
    success: false,
    error: `Unknown source: ${source}`,
  };
}

/**
 * Configurable app state loader
 * @param config - Loading configuration specifying data sources for each segment
 * @param useDefault - Whether to use default state for static loading
 * @returns Promise<AppState>
 * @throws Error if loading fails
 */
export async function loadAppStateConfigurable(
  config: LoadingConfig = getLoadingConfig(),
  useDefault = false
): Promise<AppState> {
  try {
    // Validate configuration
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
      throw new Error(`Invalid configuration: ${configErrors.join(', ')}`);
    }

    // Load each segment with configured source
    const results: Record<string, any> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const segment of ['metadata', 'user', 'bots', 'notifications'] as const) {
      const configuredSource = config[segment];

      const result = await loadDataSegment(segment, configuredSource, useDefault);

      if (result.success) {
        results[segment] = result.data;
        if (result.warnings) {
          warnings.push(...result.warnings);
        }
      } else {
        errors.push(`${segment}: ${result.error}`);
        // No fallback - if configured source fails, the segment fails
      }
    }

    // Check if we have all required segments
    const missingSegments = ['metadata', 'user', 'bots', 'notifications'].filter(
      segment => !results[segment]
    );

    if (missingSegments.length > 0) {
      throw new Error(`Failed to load segments: ${missingSegments.join(', ')}. Errors: ${errors.join('; ')}`);
    }

    // Assemble final app state
    const appState: AppState = {
      metadata: results.metadata,
      user: results.user,
      bots: results.bots,
      notifications: results.notifications,
    };

    // Validate assembled state
    const validationResult = AppStateSchema.safeParse(appState);

    if (!validationResult.success) {
      const validationErrors = validationResult.error.issues.map(issue =>
        `${issue.path.join('.')}: ${issue.message}`
      );
      throw new Error(`State validation failed: ${validationErrors.join(', ')}`);
    }

    if (warnings.length > 0) {
      console.warn('App state loaded with warnings:', warnings);
    }

    return validationResult.data;
  } catch (error) {
    throw new Error(`Configurable loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load app state with configuration and fallback to default
 * @param config - Loading configuration
 * @returns Promise<AppState>
 * @throws Error if loading fails with all fallbacks
 */
export async function loadAppStateConfigurableWithFallback(
  config: LoadingConfig = getLoadingConfig()
): Promise<AppState> {
  // Try to load with configuration
  try {
    return await loadAppStateConfigurable(config);
  } catch (error) {
    // Log the error and try default state
    console.warn('Failed to load app state with configuration:', error instanceof Error ? error.message : error);

    // Try loading with all-static configuration
    const staticConfig: LoadingConfig = {
      metadata: 'static',
      user: 'static',
      bots: 'static',
      notifications: 'static',
    };

    try {
      const result = await loadAppStateConfigurable(staticConfig, true);
      console.info('Loaded default app state as fallback');
      return result;
    } catch (staticError) {
      // Ultimate fallback to original function
      return loadAppStateWithFallback();
    }
  }
}