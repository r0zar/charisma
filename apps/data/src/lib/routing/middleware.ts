/**
 * Common middleware functions for the routing system
 */

import type { RouteMiddleware, RouteContext } from './types';
import { NextResponse } from 'next/server';

/**
 * Logging middleware - logs all requests
 */
export const loggingMiddleware: RouteMiddleware = async (context, next) => {
  const startTime = Date.now();
  console.log(`[API] ${context.method} /${context.path.join('/')}`);
  
  const response = await next();
  
  const duration = Date.now() - startTime;
  console.log(`[API] ${context.method} /${context.path.join('/')} - ${response.status} (${duration}ms)`);
  
  return response;
};

/**
 * CORS middleware - adds CORS headers
 */
export const corsMiddleware: RouteMiddleware = async (context, next) => {
  const response = await next();
  
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return response;
};

/**
 * Performance tracking middleware
 */
export const performanceMiddleware: RouteMiddleware = async (context, next) => {
  context.performance.addMark('middleware-performance-start');
  
  const response = await next();
  
  context.performance.addMark('middleware-performance-end');
  
  // Add performance headers
  const marks = context.performance.getMarks();
  const totalTime = marks['middleware-performance-end'] - marks['middleware-performance-start'];
  
  response.headers.set('X-Performance-Total', `${totalTime}ms`);
  
  // Add detailed timing if available
  if (marks['route-resolved']) {
    const resolutionTime = marks['route-resolved'] - marks['routing-start'];
    response.headers.set('X-Performance-Resolution', `${resolutionTime}ms`);
  }
  
  if (marks['handler-complete'] && marks['handler-start']) {
    const handlerTime = marks['handler-complete'] - marks['handler-start'];
    response.headers.set('X-Performance-Handler', `${handlerTime}ms`);
  }
  
  return response;
};

/**
 * Error handling middleware
 */
export const errorHandlingMiddleware: RouteMiddleware = async (context, next) => {
  try {
    return await next();
  } catch (error) {
    console.error(`[API Error] ${context.method} /${context.path.join('/')}:`, error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Invalid path')) {
        return NextResponse.json(
          {
            error: 'Invalid path format',
            message: error.message,
            path: context.path.join('/'),
            timestamp: new Date().toISOString()
          },
          { status: 400 }
        );
      }
      
      if (error.message.includes('not found')) {
        return NextResponse.json(
          {
            error: 'Resource not found',
            path: context.path.join('/'),
            timestamp: new Date().toISOString()
          },
          { status: 404 }
        );
      }
    }
    
    // Generic server error
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        path: context.path.join('/'),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
};

/**
 * Rate limiting middleware (placeholder for future implementation)
 */
export const rateLimitMiddleware: RouteMiddleware = async (context, next) => {
  // TODO: Implement rate limiting
  // For now, just pass through
  return next();
};

/**
 * Authentication middleware (placeholder for future implementation)  
 */
export const authMiddleware: RouteMiddleware = async (context, next) => {
  // TODO: Implement authentication
  // For now, just pass through
  return next();
};