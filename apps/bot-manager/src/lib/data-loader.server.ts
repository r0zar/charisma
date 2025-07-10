import { promises as fs } from 'fs';
import path from 'path';
import { type AppState } from '@/schemas/app-state.schema';
import { validateAppState, type StateResult } from './state';
import { appState } from '@/data/app-state';
import { defaultState } from '@/data/default-state';
import { type LoadingConfig, getLoadingConfig, validateConfig } from './config';
import { apiClient, type ApiClient } from './api-client';

/**
 * Server-side Data Loading Operations
 * Handles data loading with filesystem/network access and Node.js APIs
 * This file should only be imported in server-side contexts
 */

/**
 * Load and validate app state from TypeScript import
 * @param useDefault - Whether to use default state instead of main state
 * @returns Promise<StateResult>
 */
export async function loadAppState(useDefault = false): Promise<StateResult> {
  try {
    // Get the data from TypeScript import
    const rawData = useDefault ? defaultState : appState;
    
    // Validate with our unified validation function
    const result = validateAppState(rawData);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Data validation failed',
        validationErrors: result.validationErrors,
        warnings: result.warnings,
        metadata: result.metadata,
      };
    }
    
    return {
      success: true,
      data: result.data,
      warnings: result.warnings,
      metadata: result.metadata,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to load data: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Load default state as fallback
 * @returns Promise<StateResult>
 */
export async function loadDefaultState(): Promise<StateResult> {
  return loadAppState(true);
}

/**
 * Load app state with automatic fallback to default
 * @returns Promise<AppState>
 * @throws Error if both main and default states fail to load
 */
export async function loadAppStateWithFallback(): Promise<AppState> {
  // Try to load main state first
  const mainResult = await loadAppState();
  if (mainResult.success && mainResult.data) {
    if (mainResult.warnings && mainResult.warnings.length > 0) {
      console.warn('App state loaded with warnings:', mainResult.warnings);
    }
    return mainResult.data;
  }

  // Log the main state error
  console.warn('Failed to load main app state:', mainResult.error);
  if (mainResult.validationErrors) {
    console.warn('Validation errors:', mainResult.validationErrors);
  }

  // Try to load default state
  const defaultResult = await loadDefaultState();
  if (defaultResult.success && defaultResult.data) {
    console.info('Loaded default app state as fallback');
    if (defaultResult.warnings && defaultResult.warnings.length > 0) {
      console.warn('Default state loaded with warnings:', defaultResult.warnings);
    }
    return defaultResult.data;
  }

  // Both failed, throw error
  throw new Error(
    `Failed to load app state: ${mainResult.error}. Default state also failed: ${defaultResult.error}`
  );
}

/**
 * Validate state from file path or URL (server-only)
 * @param filePath - Local file path or HTTP URL to validate
 * @returns Promise<StateResult>
 */
export async function validateStateFile(filePath: string): Promise<StateResult> {
  try {
    let data: any;
    
    // Check if this is a local file path or URL
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      // Use fetch for URLs
      const response = await fetch(filePath);
      
      if (!response.ok) {
        return {
          success: false,
          error: `Failed to load state from ${filePath}: ${response.status} ${response.statusText}`,
          metadata: {
            version: 'unknown',
            botCount: 0,
            totalActivities: 0,
            dataSize: 0,
          },
        };
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
          return {
            success: false,
            error: `TypeScript file validation not yet supported: ${filePath}`,
          };
        } else {
          data = JSON.parse(fileContent);
        }
      } catch (fileError) {
        return {
          success: false,
          error: `Failed to read file ${filePath}: ${fileError instanceof Error ? fileError.message : String(fileError)}`,
          metadata: {
            version: 'unknown',
            botCount: 0,
            totalActivities: 0,
            dataSize: 0,
          },
        };
      }
    }
    
    // Use our unified validation function
    return validateAppState(data);
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse state from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      metadata: {
        version: 'unknown',
        botCount: 0,
        totalActivities: 0,
        dataSize: 0,
      },
    };
  }
}

/**
 * Load state from multiple sources with fallback chain
 * @param sources - Array of source identifiers ('main', 'default', or file paths)
 * @returns Promise<StateResult>
 */
export async function loadStateWithFallbacks(sources: string[] = ['main', 'default']): Promise<StateResult> {
  for (const source of sources) {
    try {
      let result: StateResult;
      
      if (source === 'main') {
        result = await loadAppState(false);
      } else if (source === 'default') {
        result = await loadAppState(true);
      } else {
        // Treat as file path
        result = await validateStateFile(source);
      }
      
      if (result.success) {
        return result;
      }
      
      console.warn(`Failed to load from ${source}:`, result.error);
    } catch (error) {
      console.warn(`Error loading from ${source}:`, error);
    }
  }
  
  return {
    success: false,
    error: `All sources failed: ${sources.join(', ')}`,
  };
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
 * @returns Promise<StateResult>
 */
async function loadDataSegment(
  segment: keyof Pick<AppState, 'metadata' | 'user' | 'bots' | 'market' | 'notifications'>,
  source: 'static' | 'api',
  useDefault = false
): Promise<StateResult<any>> {
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
        case 'market':
          return await apiClient.fetchMarket({ useDefault });
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
 * @returns Promise<StateResult<AppState>>
 */
export async function loadAppStateConfigurable(
  config: LoadingConfig = getLoadingConfig(),
  useDefault = false
): Promise<StateResult<AppState>> {
  try {
    // Validate configuration
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
      return {
        success: false,
        error: `Invalid configuration: ${configErrors.join(', ')}`,
        validationErrors: configErrors,
      };
    }
    
    // Load each segment with configured source
    const results: Record<string, any> = {};
    const errors: string[] = [];
    const warnings: string[] = [];
    
    for (const segment of ['metadata', 'user', 'bots', 'market', 'notifications'] as const) {
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
    const missingSegments = ['metadata', 'user', 'bots', 'market', 'notifications'].filter(
      segment => !results[segment]
    );
    
    if (missingSegments.length > 0) {
      return {
        success: false,
        error: `Failed to load segments: ${missingSegments.join(', ')}`,
        validationErrors: errors,
        warnings,
      };
    }
    
    // Assemble final app state
    const appState: AppState = {
      metadata: results.metadata,
      user: results.user,
      bots: results.bots,
      market: results.market,
      notifications: results.notifications,
    };
    
    // Validate assembled state
    const validationResult = validateAppState(appState);
    
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error || 'State validation failed',
        validationErrors: validationResult.validationErrors,
        warnings: [...warnings, ...(validationResult.warnings || [])],
      };
    }
    
    return {
      success: true,
      data: validationResult.data,
      warnings: [...warnings, ...(validationResult.warnings || [])],
      metadata: validationResult.metadata,
    };
  } catch (error) {
    return {
      success: false,
      error: `Configurable loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
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
  const result = await loadAppStateConfigurable(config);
  
  if (result.success && result.data) {
    if (result.warnings && result.warnings.length > 0) {
      console.warn('App state loaded with warnings:', result.warnings);
    }
    return result.data;
  }
  
  // Log the error and try default state
  console.warn('Failed to load app state with configuration:', result.error);
  if (result.validationErrors) {
    console.warn('Validation errors:', result.validationErrors);
  }
  
  // Try loading with all-static configuration
  const staticConfig: LoadingConfig = {
    metadata: 'static',
    user: 'static',
    bots: 'static',
    market: 'static',
    notifications: 'static',
  };
  
  const staticResult = await loadAppStateConfigurable(staticConfig, true);
  
  if (staticResult.success && staticResult.data) {
    console.info('Loaded default app state as fallback');
    return staticResult.data;
  }
  
  // Ultimate fallback to original function
  return loadAppStateWithFallback();
}