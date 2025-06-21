import { NextResponse } from 'next/server';
import { refreshPricingData, checkPricingSystemHealth } from '@/lib/pricing';

const headers = {
    'Content-Type': 'application/json'
};

// This endpoint can be called by a cron job to refresh pricing data
export async function POST(request: Request) {
    const startTime = Date.now();
    
    try {
        // Verify this is a valid cron request (basic auth or API key)
        const authHeader = request.headers.get('authorization');
        const validToken = process.env.CRON_SECRET || 'default-secret';
        
        if (authHeader !== `Bearer ${validToken}`) {
            return NextResponse.json({
                status: 'error',
                error: 'Unauthorized'
            }, {
                status: 401,
                headers
            });
        }

        console.log('[Pricing Refresh Cron] Starting pricing data refresh...');

        // Refresh all pricing data
        await refreshPricingData();

        // Check system health after refresh
        const healthCheck = await checkPricingSystemHealth();

        const processingTime = Date.now() - startTime;
        
        console.log(`[Pricing Refresh Cron] Completed in ${processingTime}ms. Health: ${healthCheck.healthy ? 'GOOD' : 'ISSUES'}`);

        return NextResponse.json({
            status: 'success',
            message: 'Pricing data refreshed successfully',
            health: healthCheck,
            metadata: {
                processingTimeMs: processingTime,
                timestamp: Date.now()
            }
        }, {
            status: 200,
            headers
        });

    } catch (error: any) {
        console.error('[Pricing Refresh Cron] Error during refresh:', error);
        
        const processingTime = Date.now() - startTime;
        
        return NextResponse.json({
            status: 'error',
            error: 'Refresh Failed',
            message: error?.message || 'Unknown error occurred',
            metadata: {
                processingTimeMs: processingTime,
                timestamp: Date.now()
            }
        }, {
            status: 500,
            headers
        });
    }
}

// Health check endpoint (no auth required)
export async function GET() {
    const startTime = Date.now();
    
    try {
        console.log('[Pricing Health Cron] Checking pricing system health...');

        const healthCheck = await checkPricingSystemHealth();
        const processingTime = Date.now() - startTime;

        return NextResponse.json({
            status: 'success',
            health: healthCheck,
            metadata: {
                processingTimeMs: processingTime,
                timestamp: Date.now()
            }
        }, {
            status: healthCheck.healthy ? 200 : 503,
            headers
        });

    } catch (error: any) {
        console.error('[Pricing Health Cron] Error during health check:', error);
        
        const processingTime = Date.now() - startTime;
        
        return NextResponse.json({
            status: 'error',
            error: 'Health Check Failed',
            message: error?.message || 'Unknown error occurred',
            metadata: {
                processingTimeMs: processingTime,
                timestamp: Date.now()
            }
        }, {
            status: 500,
            headers
        });
    }
}