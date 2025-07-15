/**
 * Middleware for tx-monitor service
 * Handles CORS for all API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleCorsPreflightRequest, addCorsHeaders } from './lib/cors-helper';

export function middleware(request: NextRequest) {
  // Only apply CORS to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    
    console.log(`[CORS Middleware] ${request.method} ${request.nextUrl.pathname} from origin: ${origin}`);
    
    // Handle OPTIONS preflight request
    if (request.method === 'OPTIONS') {
      console.log(`[CORS Middleware] Handling OPTIONS preflight request`);
      return handleCorsPreflightRequest(request);
    }
    
    // For other requests, continue to the route handler
    // but ensure CORS headers are added to the response
    const response = NextResponse.next();
    return addCorsHeaders(response, origin);
  }
  
  // For non-API routes, continue normally
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
  runtime: 'nodejs',
};