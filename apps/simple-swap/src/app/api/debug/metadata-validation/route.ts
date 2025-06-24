import { NextRequest, NextResponse } from 'next/server';
import { listOrders } from '@/lib/orders/store';

/**
 * Debug endpoint to validate Twitter metadata structure against UI expectations
 */
export async function GET(request: NextRequest) {
    try {
        // Only allow in development environment
        if (process.env.NODE_ENV !== 'development') {
            return NextResponse.json({ error: 'Debug endpoint only available in development' }, { status: 403 });
        }

        console.log('[Debug] Validating metadata structure...');
        
        // Get all Twitter orders
        const allOrders = await listOrders();
        const twitterOrders = allOrders.filter(order => order.strategyType === 'twitter');
        
        // Define the fields the UI expects
        const expectedFields = [
            'replierHandle',
            'replierDisplayName', 
            'bnsName',
            'replyTweetId',
            'executedAt'
        ];
        
        // Define additional fields we store
        const additionalFields = [
            'replyText',
            'replyCreatedAt',
            'status',
            'error'
        ];
        
        const validationResults = [];
        
        for (const order of twitterOrders) {
            if (order.metadata?.execution) {
                const execution = order.metadata.execution;
                
                // Check required fields
                const missingFields = expectedFields.filter(field => !execution[field]);
                const presentFields = expectedFields.filter(field => !!execution[field]);
                const extraFields = Object.keys(execution).filter(field => 
                    !expectedFields.includes(field) && !additionalFields.includes(field)
                );
                
                validationResults.push({
                    orderUuid: order.uuid,
                    status: order.status,
                    createdAt: order.createdAt,
                    hasExecutionMetadata: true,
                    validation: {
                        allRequiredFieldsPresent: missingFields.length === 0,
                        missingFields,
                        presentFields,
                        extraFields,
                        fieldCount: Object.keys(execution).length
                    },
                    executionMetadata: execution
                });
            } else {
                validationResults.push({
                    orderUuid: order.uuid,
                    status: order.status,
                    createdAt: order.createdAt,
                    hasExecutionMetadata: false,
                    validation: {
                        allRequiredFieldsPresent: false,
                        missingFields: expectedFields,
                        presentFields: [],
                        extraFields: [],
                        fieldCount: 0
                    },
                    executionMetadata: null
                });
            }
        }
        
        // Summary statistics
        const summary = {
            totalTwitterOrders: twitterOrders.length,
            ordersWithMetadata: validationResults.filter(r => r.hasExecutionMetadata).length,
            ordersWithValidMetadata: validationResults.filter(r => r.validation.allRequiredFieldsPresent).length,
            validationSuccessRate: twitterOrders.length > 0 
                ? Math.round((validationResults.filter(r => r.validation.allRequiredFieldsPresent).length / twitterOrders.length) * 100)
                : 0,
            expectedFields,
            additionalFields
        };
        
        console.log('[Debug] Metadata validation summary:', summary);
        
        return NextResponse.json({
            success: true,
            summary,
            validationResults,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[Debug] Error validating metadata:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}