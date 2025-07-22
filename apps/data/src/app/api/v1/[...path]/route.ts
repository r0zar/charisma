/**
 * Unified API Route - Single handler for all /api/v1/* endpoints
 * Uses the new routing system with file-based route handlers
 */

import { NextRequest } from 'next/server';
import { routingEngine } from '@/lib/routing';

export const runtime = 'edge';

/**
 * Handle all HTTP methods through the unified routing engine
 */
async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  
  // Use the routing engine to process the request
  return routingEngine.handle(request, path || []);
}

// Export all HTTP methods to the same handler
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
export const OPTIONS = handleRequest;