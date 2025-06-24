import { NextRequest, NextResponse } from 'next/server';
import { processBNSFromReply } from '@/lib/twitter-triggers/bns-resolver';

// POST /api/v1/twitter-triggers/testing/bns-batch - Test BNS resolution for multiple names
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { bnsNames } = body;
        
        if (!bnsNames || !Array.isArray(bnsNames)) {
            return NextResponse.json({
                success: false,
                error: 'bnsNames array is required'
            }, { status: 400 });
        }

        if (bnsNames.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'At least one BNS name is required'
            }, { status: 400 });
        }

        if (bnsNames.length > 10) {
            return NextResponse.json({
                success: false,
                error: 'Maximum 10 BNS names allowed per batch'
            }, { status: 400 });
        }
        
        console.log(`[Testing API] Testing BNS resolution for ${bnsNames.length} names`);
        
        const results = [];
        
        for (const bnsName of bnsNames) {
            if (typeof bnsName !== 'string' || !bnsName.trim()) {
                results.push({
                    input: bnsName,
                    success: false,
                    error: 'Invalid BNS name format'
                });
                continue;
            }

            try {
                // Test BNS processing using the same logic as real triggers
                const bnsResult = await processBNSFromReply(bnsName, bnsName);
                
                results.push({
                    input: bnsName.trim(),
                    bnsName: bnsResult.bnsName,
                    address: bnsResult.resolution?.address,
                    success: bnsResult.resolution?.success || false,
                    error: bnsResult.resolution?.error,
                    extractedFrom: bnsResult.extractedFrom || 'direct',
                    processingTime: Date.now() // Could add timing if needed
                });
                
            } catch (error) {
                console.error(`[Testing API] Error processing BNS name ${bnsName}:`, error);
                results.push({
                    input: bnsName.trim(),
                    success: false,
                    error: error instanceof Error ? error.message : 'Processing failed'
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        
        return NextResponse.json({
            success: true,
            data: {
                results,
                summary: {
                    totalTested: bnsNames.length,
                    successful: successCount,
                    failed: failureCount,
                    successRate: bnsNames.length > 0 ? (successCount / bnsNames.length * 100).toFixed(1) + '%' : '0%'
                },
                testedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('[Testing API] Error testing BNS batch:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to test BNS batch resolution',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}