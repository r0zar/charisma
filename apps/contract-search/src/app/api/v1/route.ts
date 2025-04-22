import { NextResponse } from 'next/server';

/**
 * GET /api/v1
 * Returns API documentation
 */
export async function GET() {
    const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/api/v1`
        : '/api/v1';

    const docs = {
        name: 'Contract Search API',
        version: '1.0.0',
        description: 'API for retrieving cached search results',
        endpoints: [
            {
                path: `${baseUrl}/searches`,
                method: 'GET',
                description: 'Get all saved searches',
                example: `curl -X GET ${baseUrl}/searches`
            },
            {
                path: `${baseUrl}/searches/{id}`,
                method: 'GET',
                description: 'Get a specific search by ID',
                example: `curl -X GET ${baseUrl}/searches/search-123456`
            }
            // Other endpoints coming soon
        ]
    };

    return NextResponse.json(docs);
} 