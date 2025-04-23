import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateCorsHeaders, allowedOrigins } from './lib/cors-helper';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
    // Check if it's an API request
    const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

    // Only apply CORS for API routes
    if (isApiRoute) {
        // Create a new response
        const response = NextResponse.next();

        // Get the origin from the request headers
        const origin = request.headers.get('origin') || '';

        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            return response;
        }

        // Check if the origin is allowed
        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            // Generate appropriate CORS headers
            const methods = 'GET, POST, PUT, DELETE, OPTIONS';
            const headers = generateCorsHeaders(request, methods);

            // Copy all headers to the response
            headers.forEach((value, key) => {
                response.headers.set(key, value);
            });

            // Handle preflight OPTIONS request
            if (request.method === 'OPTIONS') {
                return new NextResponse(null, {
                    status: 204,
                    headers: response.headers
                });
            }
        }

        return response;
    }

    // For non-API routes, continue without setting CORS headers
    return NextResponse.next();
}

// Only run the middleware on API routes
export const config = {
    matcher: [
        // Match all API routes
        '/api/:path*',
    ],
}; 