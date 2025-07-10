import { AppStateSchema, type AppState } from '@/schemas/app-state.schema';
import { type Bot } from '@/schemas/bot.schema';
import { ZodError } from 'zod';

/**
 * Universal State Operations
 * Pure state validation and utility functions that work in any environment
 * No Node.js dependencies - safe for client-side use
 */

// Unified result interface for all state operations
export interface StateResult<T = AppState> {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: string[];
  warnings?: string[];
  metadata?: {
    version: string;
    botCount: number;
    totalActivities: number;
    dataSize: number;
  };
}

/**
 * Validate app state with Zod schema and business logic
 * @param data - The data to validate
 * @returns StateResult with validation details
 */
export function validateAppState(data: unknown): StateResult {
  try {
    // First, validate with Zod schema
    const validatedData = AppStateSchema.parse(data);

    // Then add business logic validation warnings
    const warnings: string[] = [];

    // Check for business logic warnings
    validatedData.bots.list.forEach((bot: Bot) => {
      // No business logic validation for now
    });

    // Check token prices for unusual values
    Object.entries(validatedData.market.data.tokenPrices).forEach(([token, price]) => {
      if (price > 1000000) {
        warnings.push(`Token ${token} has unusually high price: ${price}`);
      }
    });

    // Check pool APRs
    validatedData.market.pools.forEach((pool) => {
      if (pool.apr > 1000) {
        warnings.push(`Pool ${pool.name} has unusual APR: ${pool.apr}%`);
      }
    });

    return {
      success: true,
      data: validatedData,
      warnings,
      metadata: {
        version: validatedData.metadata.version,
        botCount: validatedData.bots.list.length,
        totalActivities: validatedData.bots.activities.length,
        dataSize: JSON.stringify(validatedData).length,
      },
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const validationErrors = error.issues.map(issue =>
        `${issue.path.join('.')}: ${issue.message}`
      );
      return {
        success: false,
        error: 'Data validation failed',
        validationErrors,
        metadata: {
          version: 'unknown',
          botCount: 0,
          totalActivities: 0,
          dataSize: JSON.stringify(data).length,
        },
      };
    }

    return {
      success: false,
      error: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      metadata: {
        version: 'unknown',
        botCount: 0,
        totalActivities: 0,
        dataSize: JSON.stringify(data).length,
      },
    };
  }
}

/**
 * Safe parse with Zod schema (no business logic validation)
 * @param data - The data to parse
 * @returns Zod SafeParseResult
 */
export function safeParseAppState(data: unknown) {
  return AppStateSchema.safeParse(data);
}

/**
 * Type guard to check if data is valid AppState
 * @param data - The data to check
 * @returns boolean indicating if data is valid AppState
 */
export function isValidAppState(data: unknown): data is AppState {
  return AppStateSchema.safeParse(data).success;
}

/**
 * Quick validation that only returns success/failure
 * @param data - The data to validate
 * @returns boolean indicating if validation passed
 */
export function isValidState(data: unknown): boolean {
  return validateAppState(data).success;
}

// Schema version handling
export const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * Check if a schema version is compatible with current version
 * @param version - Version string to check
 * @returns boolean indicating compatibility
 */
export function isCompatibleVersion(version: string): boolean {
  const [major, minor, patch] = version.split('.').map(Number);
  const [currentMajor, currentMinor, _currentPatch] = CURRENT_SCHEMA_VERSION.split('.').map(Number);

  // Same major version is compatible
  if (major === currentMajor) {
    return true;
  }

  // Future major versions are not compatible
  if (major > currentMajor) {
    return false;
  }

  // Past major versions might need migration
  return false;
}

/**
 * Extract metadata from app state without full validation
 * @param data - Raw data that might be app state
 * @returns Partial metadata or null if extraction fails
 */
export function extractStateMetadata(data: unknown): Partial<StateResult['metadata']> | null {
  try {
    if (typeof data === 'object' && data !== null) {
      const obj = data as any;
      return {
        version: obj.metadata?.version || 'unknown',
        botCount: obj.bots?.list?.length || 0,
        totalActivities: obj.bots?.activities?.length || 0,
        dataSize: JSON.stringify(data).length,
      };
    }
  } catch (error) {
    // Ignore extraction errors
  }
  return null;
}

// Export types for external use
export type { AppState } from '@/schemas/app-state.schema';