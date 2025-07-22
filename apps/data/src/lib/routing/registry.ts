/**
 * Route Handler Registry - File-based discovery and management
 */

import type { RouteHandler, RouteRegistry } from './types';
// Edge runtime compatible path joining

class RouteHandlerRegistry implements RouteRegistry {
  public handlers = new Map<string, RouteHandler>();
  private discovered = false;

  /**
   * Register a route handler for a specific path
   */
  register(path: string, handler: RouteHandler): void {
    console.log(`[RouteRegistry] Registering handler for path: ${path}`);
    this.handlers.set(path, { ...handler, path });
  }

  /**
   * Find exact matching handler for a path
   */
  find(path: string): RouteHandler | null {
    this.ensureDiscovered();
    
    // Try exact match first
    const exactMatch = this.handlers.get(path);
    if (exactMatch) {
      return exactMatch;
    }

    // For now, only exact matches (can be extended for prefix/pattern matching later)
    return null;
  }

  /**
   * Find all handlers, optionally filtered by path prefix
   */
  findAll(pathPrefix?: string): RouteHandler[] {
    this.ensureDiscovered();
    
    const handlers = Array.from(this.handlers.values());
    
    if (!pathPrefix) {
      return handlers;
    }
    
    return handlers.filter(handler => handler.path.startsWith(pathPrefix));
  }

  /**
   * Discover route handlers from filesystem
   */
  private async discoverHandlers(): Promise<void> {
    try {
      console.log('[RouteRegistry] Discovering route handlers...');
      
      // For now, manually register known handlers
      // In production, this would use a build-time discovery process
      const knownHandlers = [
        // 'src/lib/routes/prices/current/handler.ts'  // Temporarily disabled
      ];
      
      const handlerFiles = knownHandlers;

      for (const filePath of handlerFiles) {
        try {
          await this.loadHandler(filePath);
        } catch (error) {
          console.warn(`[RouteRegistry] Failed to load handler from ${filePath}:`, error);
        }
      }

      console.log(`[RouteRegistry] Discovered ${this.handlers.size} route handlers`);
    } catch (error) {
      console.error('[RouteRegistry] Handler discovery failed:', error);
    }
  }

  /**
   * Load a specific handler file
   */
  private async loadHandler(filePath: string): Promise<void> {
    try {
      // Import the handler module
      const module = await import(filePath);
      const handler = module.default || module.handler;

      if (!handler || typeof handler !== 'object') {
        console.warn(`[RouteRegistry] No default export or handler export in ${filePath}`);
        return;
      }

      // Extract path from file structure
      // e.g., src/lib/routes/prices/current/handler.ts -> prices/current
      const pathMatch = filePath.match(/lib\/routes\/(.+)\/handler\.(ts|js)$/);
      
      if (!pathMatch) {
        console.warn(`[RouteRegistry] Could not extract path from ${filePath}`);
        return;
      }

      const routePath = pathMatch[1];
      this.register(routePath, handler as RouteHandler);
      
    } catch (error) {
      console.error(`[RouteRegistry] Error loading handler from ${filePath}:`, error);
    }
  }

  /**
   * Ensure handlers have been discovered
   */
  private ensureDiscovered(): void {
    if (!this.discovered) {
      this.discovered = true;
      // Run discovery in background - for now we'll do it synchronously in dev
      // In production, this would be done at build time or startup
      this.discoverHandlers().catch(error => {
        console.error('[RouteRegistry] Background discovery failed:', error);
      });
    }
  }

  /**
   * Clear all registered handlers (for testing)
   */
  clear(): void {
    this.handlers.clear();
    this.discovered = false;
  }

  /**
   * Get registry statistics
   */
  getStats(): { totalHandlers: number; handlerPaths: string[] } {
    this.ensureDiscovered();
    return {
      totalHandlers: this.handlers.size,
      handlerPaths: Array.from(this.handlers.keys())
    };
  }
}

// Export singleton instance
export const routeRegistry = new RouteHandlerRegistry();