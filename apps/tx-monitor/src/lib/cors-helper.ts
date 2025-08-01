/**
 * CORS helper utilities for tx-monitor service
 * Handles cross-origin requests from charisma.rocks subdomains
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHostUrl } from '@modules/discovery';

/**
 * Allowed origins for CORS requests
 */
const ALLOWED_ORIGINS = [
  // Production charisma.rocks domains
  'https://charisma.rocks',
  'https://www.charisma.rocks',
  getHostUrl('swap', 'production'),
  getHostUrl('tx-monitor', 'production'),
  getHostUrl('invest', 'production'),
  getHostUrl('tokens', 'production'),
  'https://bots.charisma.rocks',

  // Development localhost
  getHostUrl('tokens', 'development'),
  getHostUrl('swap', 'development'),
  getHostUrl('invest', 'development'),
  getHostUrl('tx-monitor', 'development'),
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
  'http://localhost:3006',
  'http://localhost:3007',
  'http://localhost:3008',
  'http://localhost:3009',
  'http://localhost:3010',
  'http://localhost:3011',
  'http://localhost:3012',
  'http://localhost:3020',
];

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  // Check exact matches first
  if (ALLOWED_ORIGINS.includes(origin)) {
    console.log(`[CORS] Origin ${origin} allowed (exact match)`);
    return true;
  }

  // Check wildcard pattern for *.charisma.rocks
  if (origin.endsWith('.charisma.rocks')) {
    // Verify it's a valid subdomain pattern
    const match = origin.match(/^https:\/\/([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)\.charisma\.rocks$/);
    if (match) {
      console.log(`[CORS] Origin ${origin} allowed (subdomain match)`);
      return true;
    }
  }

  console.log(`[CORS] Origin ${origin} not allowed`);
  return false;
}

/**
 * Generate CORS headers for a given origin
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  };

  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Handle CORS preflight OPTIONS request
 */
export function handleCorsPreflightRequest(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

/**
 * Add CORS headers to a response
 */
export function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  const corsHeaders = getCorsHeaders(origin);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Create a new response with CORS headers
 */
export function createCorsResponse(
  body: any,
  init: ResponseInit = {},
  origin: string | null = null
): NextResponse {
  const response = NextResponse.json(body, init);
  return addCorsHeaders(response, origin);
}