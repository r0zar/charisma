/**
 * Unified Routing System - Main exports
 */

// Core components
export { routingEngine } from './engine';
export { routeRegistry } from './registry';
export { RouteResolver, PathValidator, createRouteContext } from './resolver';
export { defaultCrudOperations, validateRequestData } from './crud';

// Middleware
export {
  loggingMiddleware,
  corsMiddleware,
  performanceMiddleware,
  errorHandlingMiddleware,
  rateLimitMiddleware,
  authMiddleware
} from './middleware';

// Types
export type {
  RouteContext,
  RouteOperations,
  RouteHandler,
  CrudOperation,
  RouteRegistry,
  RouteMiddleware,
  RouteResolution
} from './types';

// Setup function for configuring the routing engine
export function setupRouting() {
  try {
    // Configure default middleware stack
    routingEngine.use(errorHandlingMiddleware);
    routingEngine.use(loggingMiddleware);
    routingEngine.use(performanceMiddleware);
    routingEngine.use(corsMiddleware);
    
    console.log('[RoutingSystem] Unified routing system initialized');
    
    // Log discovered routes
    const stats = routeRegistry.getStats();
    console.log(`[RoutingSystem] ${stats.totalHandlers} route handlers discovered:`, stats.handlerPaths);
  } catch (error) {
    console.error('[RoutingSystem] Setup failed:', error);
    throw error;
  }
}