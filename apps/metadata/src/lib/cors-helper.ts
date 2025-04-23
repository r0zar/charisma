import { NextRequest } from 'next/server';

// List of allowed origins
export const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'https://launchpad.charisma.rocks',
    'https://charisma-launchpad.vercel.app',
    'https://charisma.rocks'
];

/**
 * Generate CORS headers for API responses
 * @param req NextRequest object
 * @param methods HTTP methods to allow
 * @returns Headers object with CORS headers
 */
export function generateCorsHeaders(req: NextRequest, methods: string = 'GET'): Headers {
    const origin = req.headers.get('origin') || '';
    const headers = new Headers();

    const isAllowedOrigin = process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin);

    // Only set headers if the origin is allowed
    if (isAllowedOrigin) {
        // In development, use the actual origin; in production, use the matched origin
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Methods', methods);
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-signature, x-public-key');

        // For credentials like cookies
        if (methods.includes('POST') || methods.includes('DELETE')) {
            headers.set('Access-Control-Allow-Credentials', 'true');
        }
    }

    return headers;
} 