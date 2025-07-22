/**
 * API middleware for request parsing and validation
 * Extracts common parsing logic from route handlers
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseApiPath, generateBlobPath, type ParsedApiPath } from './stacks-validation';

export interface APIContext {
  params: { path: string[] };
  parsed: ParsedApiPath | null;
  blobPath: string | null;
  query: {
    stream: boolean;
    offset: number;
    limit: number;
    debug: boolean;
  };
  performance: {
    startTime: number;
    addMark: (name: string) => void;
    getDuration: (from?: string) => number;
  };
}

export type APIHandler = (request: NextRequest, context: APIContext) => Promise<NextResponse>;

/**
 * Performance tracking utilities
 */
class PerformanceTracker {
  startTime: number;
  marks: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
    this.marks.set('start', this.startTime);
  }

  addMark(name: string): void {
    this.marks.set(name, Date.now());
  }

  getDuration(from: string = 'start'): number {
    const fromTime = this.marks.get(from) || this.startTime;
    return Date.now() - fromTime;
  }

  getAllMarks(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, time] of this.marks) {
      result[name] = time - this.startTime;
    }
    return result;
  }
}

/**
 * Creates API middleware that handles common request parsing
 */
export function withApiMiddleware(handler: APIHandler) {
  return async function (
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
  ): Promise<NextResponse> {
    const performance = new PerformanceTracker();

    try {
      // Parse params
      const { path } = await params;
      performance.addMark('params-parsed');

      // Parse query parameters
      const url = new URL(request.url);
      const query = {
        stream: url.searchParams.get('stream') === 'true',
        offset: parseInt(url.searchParams.get('offset') || '0', 10),
        limit: parseInt(url.searchParams.get('limit') || '1000', 10),
        debug: url.searchParams.get('debug') === 'true'
      };
      performance.addMark('query-parsed');

      // Parse API path if not empty
      let parsed: ParsedApiPath | null = null;
      let blobPath: string | null = null;

      if (path && path.length > 0) {
        parsed = parseApiPath(path);
        if (parsed) {
          blobPath = generateBlobPath(parsed);
        }
        performance.addMark('api-path-parsed');
      }

      // Create context
      const context: APIContext = {
        params: { path },
        parsed,
        blobPath,
        query,
        performance: {
          startTime: performance.startTime,
          addMark: (name) => performance.addMark(name),
          getDuration: (from) => performance.getDuration(from)
        }
      };

      // Call the actual handler
      performance.addMark('handler-start');
      const response = await handler(request, context);
      performance.addMark('handler-complete');

      // Add performance headers if debug mode
      if (query.debug) {
        const totalTime = performance.getDuration();
        const marks = performance.getAllMarks();

        response.headers.set('X-Response-Time', `${totalTime}ms`);
        response.headers.set('X-Performance-Marks', JSON.stringify(marks));
      }

      return response;

    } catch (error) {
      console.error('API middleware error:', error);

      // Return structured error response
      const errorResponse = {
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
        duration: performance.getDuration()
      };

      return NextResponse.json(errorResponse, {
        status: error instanceof APIError ? error.status : 500
      });
    }
  };
}

/**
 * Validation middleware
 */
export function withValidation(
  validator: (context: APIContext) => ValidationResult
) {
  return function (handler: APIHandler): APIHandler {
    return async function (request: NextRequest, context: APIContext): Promise<NextResponse> {
      context.performance.addMark('validation-start');

      const validation = validator(context);

      context.performance.addMark('validation-complete');

      if (!validation.isValid) {
        return NextResponse.json({
          error: 'Validation failed',
          details: validation.errors,
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }

      return handler(request, context);
    };
  };
}

/**
 * Common validation results
 */
export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}

/**
 * Standard validators
 */
export const validators = {
  requirePath: (context: APIContext): ValidationResult => {
    if (!context.params.path || context.params.path.length === 0) {
      return { isValid: false, errors: ['Path is required'] };
    }
    return { isValid: true };
  },

  requireParsedPath: (context: APIContext): ValidationResult => {
    if (!context.parsed) {
      return { isValid: false, errors: ['Invalid API path format'] };
    }
    return { isValid: true };
  },

  requireBlobPath: (context: APIContext): ValidationResult => {
    if (!context.blobPath) {
      return { isValid: false, errors: ['Could not determine storage path'] };
    }
    return { isValid: true };
  },

  validatePagination: (context: APIContext): ValidationResult => {
    const { offset, limit } = context.query;
    const errors: string[] = [];

    if (offset < 0) {
      errors.push('Offset must be non-negative');
    }

    if (limit <= 0 || limit > 10000) {
      errors.push('Limit must be between 1 and 10000');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
};

/**
 * Combine multiple validators
 */
export function combineValidators(...validators: Array<(context: APIContext) => ValidationResult>) {
  return (context: APIContext): ValidationResult => {
    for (const validator of validators) {
      const result = validator(context);
      if (!result.isValid) {
        return result;
      }
    }
    return { isValid: true };
  };
}

/**
 * Custom API Error class
 */
export class APIError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Error handling middleware
 */
export function withErrorHandling(handler: APIHandler): APIHandler {
  return async function (request: NextRequest, context: APIContext): Promise<NextResponse> {
    try {
      return await handler(request, context);
    } catch (error) {
      context.performance.addMark('error-caught');

      console.error('API error:', error);

      if (error instanceof APIError) {
        return NextResponse.json({
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
          duration: context.performance.getDuration()
        }, { status: error.status });
      }

      if (error instanceof Error) {
        // Handle known error types
        if (error.message.includes('not found')) {
          return NextResponse.json({
            error: 'Resource not found',
            path: context.params.path.join('/'),
            timestamp: new Date().toISOString()
          }, { status: 404 });
        }
      }

      // Generic error response
      return NextResponse.json({
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        duration: context.performance.getDuration()
      }, { status: 500 });
    }
  };
}

/**
 * Compose multiple middlewares
 */
export function compose(...middlewares: Array<(handler: APIHandler) => APIHandler>) {
  return (handler: APIHandler): APIHandler => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
}