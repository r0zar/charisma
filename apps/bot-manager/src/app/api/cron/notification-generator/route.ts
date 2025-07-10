import { type NextRequest, NextResponse } from 'next/server';
import { generateEventNotifications } from '@/lib/notification-generator';
import { isKVAvailable } from '@/lib/kv-store';

/**
 * Notification generation cron job
 * 
 * POST /api/cron/notification-generator
 * 
 * Runs every 2 minutes to detect critical system events and generate notifications.
 * Security: Requires CRON_SECRET header for authentication.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Security check
  if (!cronSecret) {
    console.error('[NotificationGenerator] CRON_SECRET environment variable is not set');
    return NextResponse.json({ 
      status: 'error', 
      message: 'Server configuration error (missing cron secret)' 
    }, { status: 500 });
  }
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[NotificationGenerator] Unauthorized cron job access attempt');
    return NextResponse.json({ 
      status: 'error', 
      message: 'Unauthorized' 
    }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[NotificationGenerator] Starting event-driven notification generation...');

  try {
    // Check KV availability
    const kvAvailable = await isKVAvailable();
    if (!kvAvailable) {
      console.error('[NotificationGenerator] KV store is not available');
      return NextResponse.json({
        status: 'error',
        message: 'KV store unavailable',
        executionTime: Date.now() - startTime
      }, { status: 503 });
    }

    // Generate notifications based on system events
    const result = await generateEventNotifications({
      // Custom configuration for cron job
      lowFundsThreshold: 10, // STX
      highValueTransactionThreshold: 100, // USD
      maxFailedTransactionsPerHour: 5,
      botOfflineThresholdMinutes: 30,
      maxNotificationsPerUserPerHour: 20,
      deduplicationWindowHours: 4
    });

    const executionTime = Date.now() - startTime;

    if (result.success) {
      console.log(`[NotificationGenerator] Successfully generated ${result.notificationsGenerated} notifications from ${result.eventsProcessed} events in ${executionTime}ms`);
      
      return NextResponse.json({
        status: 'success',
        message: 'Notification generation completed successfully',
        data: {
          notificationsGenerated: result.notificationsGenerated,
          eventsProcessed: result.eventsProcessed,
          executionTime: result.executionTime,
          errors: result.errors
        },
        timestamp: new Date().toISOString()
      }, { status: 200 });
    } else {
      console.warn(`[NotificationGenerator] Completed with errors. Generated ${result.notificationsGenerated} notifications. Errors: ${result.errors.join(', ')}`);
      
      return NextResponse.json({
        status: 'partial_success',
        message: 'Notification generation completed with some errors',
        data: {
          notificationsGenerated: result.notificationsGenerated,
          eventsProcessed: result.eventsProcessed,
          executionTime: result.executionTime,
          errors: result.errors
        },
        timestamp: new Date().toISOString()
      }, { status: 207 }); // Multi-status
    }

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    console.error('[NotificationGenerator] Critical error during notification generation:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Failed to generate notifications',
      error: errorMessage,
      executionTime,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET endpoint for health checking
 */
export async function GET(request: NextRequest) {
  try {
    const kvAvailable = await isKVAvailable();
    
    return NextResponse.json({
      status: 'healthy',
      message: 'Notification generator cron job is available',
      kvStore: kvAvailable ? 'available' : 'unavailable',
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('[NotificationGenerator] Health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}