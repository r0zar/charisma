/**
 * Define CORS headers for API routes
 */
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Handle OPTIONS request for CORS preflight
 */
export function handleOptions() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
} 