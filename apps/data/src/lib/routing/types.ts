/**
 * Unified routing system types
 */

import { NextRequest, NextResponse } from 'next/server';

// Core context passed to all route handlers
export interface RouteContext {
  request: NextRequest;
  path: string[];
  blobPath: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query: URLSearchParams;
  params: Record<string, string>;
  performance: {
    startTime: number;
    addMark: (name: string) => void;
    getMarks: () => Record<string, number>;
  };
  cache: {
    get: <T>(key: string) => Promise<T | null>;
    set: <T>(key: string, value: T, ttl?: number) => Promise<void>;
    clear: (key: string) => Promise<void>;
  };
}

// Route handler operations
export interface RouteOperations {
  get?: (context: RouteContext) => Promise<NextResponse>;
  post?: (context: RouteContext) => Promise<NextResponse>;
  put?: (context: RouteContext) => Promise<NextResponse>;
  delete?: (context: RouteContext) => Promise<NextResponse>;
}

// Route handler with metadata
export interface RouteHandler extends RouteOperations {
  // Handler metadata
  path: string;
  description?: string;
  version?: string;
  
  // Validation and middleware
  validate?: (context: RouteContext) => Promise<void>;
  beforeRequest?: (context: RouteContext) => Promise<void>;
  afterRequest?: (context: RouteContext, response: NextResponse) => Promise<NextResponse>;
  
  // Override default behavior
  overrideCrud?: boolean; // If true, skip default blob operations
  requireAuth?: boolean;
  cachePolicy?: {
    ttl: number;
    strategy: 'cache-first' | 'network-first' | 'no-cache';
  };
}

// Default CRUD operation results
export interface CrudOperation {
  get: (blobPath: string, context: RouteContext) => Promise<NextResponse>;
  post: (blobPath: string, data: any, context: RouteContext) => Promise<NextResponse>;
  put: (blobPath: string, data: any, context: RouteContext) => Promise<NextResponse>;
  delete: (blobPath: string, context: RouteContext) => Promise<NextResponse>;
}

// Route registry for discovered handlers
export interface RouteRegistry {
  handlers: Map<string, RouteHandler>;
  register: (path: string, handler: RouteHandler) => void;
  find: (path: string) => RouteHandler | null;
  findAll: (pathPrefix?: string) => RouteHandler[];
}

// Middleware function type
export type RouteMiddleware = (
  context: RouteContext,
  next: () => Promise<NextResponse>
) => Promise<NextResponse>;

// Route resolution result
export interface RouteResolution {
  handler?: RouteHandler;
  blobPath: string;
  pathParams: Record<string, string>;
  useCrud: boolean;
}