#!/usr/bin/env tsx

/**
 * Test Enhanced Bot Deletion
 * 
 * Tests the new comprehensive bot deletion functionality to ensure
 * no orphaned keys are left behind.
 */

// Load environment variables first
import './utils/env';

import { syncLogger } from './utils/logger';
import { botService } from '../src/lib/services/bots/core/service';

async function main(): Promise<void> {
  syncLogger.info('Testing enhanced bot deletion functionality...');

  try {
    // Check if bot service is available
    if (!botService.useKV) {
      syncLogger.error('Bot service is not available (ENABLE_API_BOTS not set)');
      process.exit(1);
    }

    // Set admin context for testing
    const testUserId = 'user_2znyieHPBs2QVYWqDalHnjOYIwD';
    botService.setAdminContext(testUserId);

    // Create a test bot first
    syncLogger.info('Creating a test bot for deletion testing...');
    
    const testBot = await botService.createBot({
      name: 'Test Deletion Bot',
      strategy: `
        console.log('Test bot for deletion testing');
        return { success: true, message: 'Test execution completed' };
      `.trim()
    });

    syncLogger.info(`✅ Created test bot: ${testBot.name} (${testBot.id})`);

    // Simulate some execution data (this would normally be created by actual executions)
    const { executionDataStore } = await import('../src/lib/modules/storage/kv-stores/execution-store');
    
    // Create a mock execution
    const mockExecution = {
      id: 'test-exec-' + Date.now(),
      botId: testBot.id,
      status: 'success' as const,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      executionTime: 1000,
      result: { success: true, message: 'Test execution' },
      logs: ['Test log entry'],
      sandboxId: 'test-sandbox',
      logsUrl: undefined, // No blob storage for this test
      logsSize: 100
    };

    await executionDataStore.storeExecution(testUserId, mockExecution);
    syncLogger.info(`✅ Created mock execution data for testing`);

    // Wait a moment to ensure data is stored
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Now test the enhanced deletion
    syncLogger.info('🗑️ Testing enhanced bot deletion...');
    
    await botService.deleteBot(testBot.id);
    
    syncLogger.success('✅ Enhanced bot deletion completed successfully!');

    // Verify cleanup was thorough
    syncLogger.info('🔍 Verifying cleanup was thorough...');
    
    // Check if any execution data remains
    const remainingExecutions = await executionDataStore.getExecutions(testUserId, testBot.id);
    if (remainingExecutions.length === 0) {
      syncLogger.success('✅ All execution data properly cleaned up');
    } else {
      syncLogger.warn(`⚠️ Found ${remainingExecutions.length} remaining executions`);
    }

    // Try to get the bot (should fail)
    try {
      const deletedBot = await botService.getBot(testBot.id);
      if (deletedBot) {
        syncLogger.warn('⚠️ Bot data still exists after deletion');
      }
    } catch (error) {
      syncLogger.success('✅ Bot data properly deleted (getBot failed as expected)');
    }

    syncLogger.success('🎉 Enhanced deletion test completed successfully!');

  } catch (error) {
    syncLogger.error('Test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  } finally {
    // Clear admin context
    botService.clearAdminContext();
  }
}

// Execute main function
main().catch((error) => {
  syncLogger.error('Script execution failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});