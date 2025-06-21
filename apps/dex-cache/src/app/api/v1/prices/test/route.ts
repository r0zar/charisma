import { NextResponse } from 'next/server';
import { testPricingSystem } from '@/lib/pricing/test-pricing';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: Request) {
    const startTime = Date.now();
    
    try {
        console.log('[Price Test API] Running pricing system test...');

        // Capture console output
        const logs: string[] = [];
        const originalLog = console.log;
        console.log = (...args: any[]) => {
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            logs.push(message);
            originalLog(...args);
        };

        try {
            await testPricingSystem();
        } finally {
            console.log = originalLog;
        }

        const processingTime = Date.now() - startTime;
        
        console.log(`[Price Test API] Test completed in ${processingTime}ms`);

        return NextResponse.json({
            status: 'success',
            message: 'Pricing system test completed',
            data: {
                logs,
                testResults: 'See logs for detailed results'
            },
            metadata: {
                processingTimeMs: processingTime,
                timestamp: Date.now()
            }
        }, {
            status: 200,
            headers
        });

    } catch (error: any) {
        console.error('[Price Test API] Error during test:', error);
        
        const processingTime = Date.now() - startTime;
        
        return NextResponse.json({
            status: 'error',
            error: 'Test Failed',
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