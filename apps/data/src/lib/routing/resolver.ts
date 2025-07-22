/**
 * Path resolution and validation system
 */

import type { RouteResolution, RouteContext } from './types';
import { routeRegistry } from './registry';

/**
 * Path validator - ensures paths are safe for blob storage
 */
export class PathValidator {
  private static readonly FORBIDDEN_PATTERNS = [
    /\.\./,           // No parent directory traversal
    /^\/|\/$/,        // No leading/trailing slashes
    /\/\//,           // No double slashes
    /[<>:"|?*]/,      // No invalid filename characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // No Windows reserved names
  ];

  private static readonly MAX_PATH_LENGTH = 260;
  private static readonly MAX_SEGMENT_LENGTH = 100;

  static validate(pathSegments: string[]): { valid: boolean; error?: string } {
    // Check total path length
    const fullPath = pathSegments.join('/');
    if (fullPath.length > this.MAX_PATH_LENGTH) {
      return { valid: false, error: `Path too long (max ${this.MAX_PATH_LENGTH} chars)` };
    }

    // Validate each segment
    for (const segment of pathSegments) {
      if (!segment || segment.length === 0) {
        return { valid: false, error: 'Empty path segments not allowed' };
      }

      if (segment.length > this.MAX_SEGMENT_LENGTH) {
        return { valid: false, error: `Path segment too long (max ${this.MAX_SEGMENT_LENGTH} chars)` };
      }

      // Check forbidden patterns
      for (const pattern of this.FORBIDDEN_PATTERNS) {
        if (pattern.test(segment)) {
          return { valid: false, error: `Invalid path segment: ${segment}` };
        }
      }
    }

    return { valid: true };
  }

  static sanitize(pathSegments: string[]): string[] {
    return pathSegments
      .filter(segment => segment && segment.length > 0)
      .map(segment => segment.trim())
      .filter(segment => segment.length > 0);
  }
}

/**
 * Route resolver - matches paths to handlers and validates
 */
export class RouteResolver {
  /**
   * Resolve a path to handler and blob path
   */
  static async resolve(context: RouteContext): Promise<RouteResolution> {
    const { path } = context;
    
    // Sanitize and validate path
    const sanitizedPath = PathValidator.sanitize(path);
    const validation = PathValidator.validate(sanitizedPath);
    
    if (!validation.valid) {
      throw new Error(`Invalid path: ${validation.error}`);
    }

    // Generate blob path (auto-mapping)
    const blobPath = sanitizedPath.join('/');
    
    // Try to find a specific handler for this path
    const handler = routeRegistry.find(blobPath);
    
    // Extract path parameters (for future pattern matching)
    const pathParams: Record<string, string> = {};
    
    // Determine if we should use CRUD operations
    const useCrud = !handler || !handler.overrideCrud;

    return {
      handler: handler || undefined,
      blobPath,
      pathParams,
      useCrud
    };
  }

  /**
   * Extract parameters from parameterized paths (future feature)
   */
  static extractParams(pattern: string, actualPath: string): Record<string, string> {
    // For now, return empty params
    // Later can implement :param and * matching
    return {};
  }

  /**
   * Check if a path matches a pattern (future feature)
   */
  static matchesPattern(pattern: string, path: string): boolean {
    // For now, only exact matches
    return pattern === path;
  }
}

/**
 * Build context object for route handlers
 */
export function createRouteContext(
  request: Request,
  pathSegments: string[]
): RouteContext {
  const url = new URL(request.url);
  const startTime = Date.now();
  const marks: Record<string, number> = { 'request-start': startTime };

  return {
    request: request as any, // NextRequest compatible
    path: pathSegments,
    blobPath: '', // Will be set by resolver
    method: request.method as any,
    query: url.searchParams,
    params: {},
    performance: {
      startTime,
      addMark: (name: string) => {
        marks[name] = Date.now();
      },
      getMarks: () => ({ ...marks })
    },
    cache: {
      // Simple in-memory cache for now
      get: async <T>(key: string): Promise<T | null> => {
        // TODO: Implement proper caching
        return null;
      },
      set: async <T>(key: string, value: T, ttl?: number): Promise<void> => {
        // TODO: Implement proper caching
      },
      clear: async (key: string): Promise<void> => {
        // TODO: Implement proper caching
      }
    }
  };
}