/**
 * Unified Routing Engine - Main orchestrator for the routing system
 */

import { NextRequest, NextResponse } from 'next/server';
import { RouteResolver, createRouteContext } from './resolver';
import { defaultCrudOperations, validateRequestData } from './crud';
import type { RouteContext, RouteHandler, RouteMiddleware } from './types';

/**
 * Main routing engine that handles all API requests
 */
export class RoutingEngine {
  private middlewares: RouteMiddleware[] = [];

  /**
   * Add middleware to the processing chain
   */
  use(middleware: RouteMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Process an incoming API request
   */
  async handle(request: NextRequest, pathSegments: string[]): Promise<NextResponse> {
    const context = createRouteContext(request, pathSegments);
    context.performance.addMark('routing-start');

    try {
      // Resolve the route
      const resolution = await RouteResolver.resolve(context);
      context.blobPath = resolution.blobPath;
      context.params = resolution.pathParams;

      context.performance.addMark('route-resolved');

      // Execute middleware chain and route handler
      const response = await this.executeWithMiddleware(context, resolution.handler, resolution.useCrud);
      
      context.performance.addMark('routing-complete');
      
      // Add performance headers
      const totalTime = context.performance.getMarks()['routing-complete'] - 
                       context.performance.getMarks()['routing-start'];
      response.headers.set('X-Total-Time', `${totalTime}ms`);
      response.headers.set('X-Route-Path', context.blobPath);
      
      return response;

    } catch (error) {
      console.error('[RoutingEngine] Error processing request:', error);
      
      return NextResponse.json(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
          path: pathSegments.join('/'),
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }
  }

  /**
   * Execute middleware chain followed by route handler
   */
  private async executeWithMiddleware(
    context: RouteContext,
    handler: RouteHandler | undefined,
    useCrud: boolean
  ): Promise<NextResponse> {
    let middlewareIndex = 0;

    const next = async (): Promise<NextResponse> => {
      // Execute next middleware
      if (middlewareIndex < this.middlewares.length) {
        const middleware = this.middlewares[middlewareIndex++];
        return middleware(context, next);
      }

      // All middleware executed, now handle the actual request
      return this.executeHandler(context, handler, useCrud);
    };

    return next();
  }

  /**
   * Execute the route handler or default CRUD operations
   */
  private async executeHandler(
    context: RouteContext,
    handler: RouteHandler | undefined,
    useCrud: boolean
  ): Promise<NextResponse> {
    context.performance.addMark('handler-start');

    // Run handler validation if present
    if (handler?.validate) {
      await handler.validate(context);
    }

    // Run beforeRequest hook if present
    if (handler?.beforeRequest) {
      await handler.beforeRequest(context);
    }

    let response: NextResponse;

    // Execute custom handler or default CRUD
    if (handler && this.hasMethodHandler(handler, context.method)) {
      response = await this.executeCustomHandler(handler, context);
    } else if (useCrud) {
      response = await this.executeCrudOperation(context);
    } else {
      response = NextResponse.json(
        { error: `Method ${context.method} not supported for this path` },
        { status: 405 }
      );
    }

    // Run afterRequest hook if present
    if (handler?.afterRequest) {
      response = await handler.afterRequest(context, response);
    }

    context.performance.addMark('handler-complete');
    return response;
  }

  /**
   * Check if handler has a method implementation
   */
  private hasMethodHandler(handler: RouteHandler, method: string): boolean {
    const methodKey = method.toLowerCase() as keyof RouteHandler;
    return typeof handler[methodKey] === 'function';
  }

  /**
   * Execute custom route handler
   */
  private async executeCustomHandler(handler: RouteHandler, context: RouteContext): Promise<NextResponse> {
    const method = context.method.toLowerCase() as keyof RouteHandler;
    const handlerFn = handler[method] as Function;
    
    if (!handlerFn) {
      throw new Error(`Handler method ${context.method} not implemented`);
    }

    return handlerFn(context);
  }

  /**
   * Execute default CRUD operation
   */
  private async executeCrudOperation(context: RouteContext): Promise<NextResponse> {
    const { method, blobPath } = context;

    switch (method) {
      case 'GET':
        return defaultCrudOperations.get(blobPath, context);

      case 'POST':
        const postData = await validateRequestData(context);
        return defaultCrudOperations.post(blobPath, postData, context);

      case 'PUT':
        const putData = await validateRequestData(context);
        return defaultCrudOperations.put(blobPath, putData, context);

      case 'DELETE':
        return defaultCrudOperations.delete(blobPath, context);

      default:
        return NextResponse.json(
          { error: `Method ${method} not supported` },
          { status: 405 }
        );
    }
  }
}

// Export singleton instance
export const routingEngine = new RoutingEngine();