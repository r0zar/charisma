import { afterEach, beforeEach } from 'vitest';
import { config } from 'dotenv';
import { initTestLogging, cleanupTestLogging } from './utils/test-logger';

// Load environment variables from .env.test for integration tests
config({ path: '.env.test' });

// Setup for both unit and integration tests

// Initialize test logging - redirects console output to timestamped log files
const testLogger = initTestLogging();

// Store original console for restoration if needed
const originalConsole = { ...global.console };

// Restore console for specific tests that need it
export const restoreConsole = () => {
  global.console = originalConsole;
};

// Get the current test log file path
export const getTestLogFile = () => testLogger.getLogFile();

// Write custom messages to test log
export const writeToTestLog = (message: string) => testLogger.writeToLog(message);

// Cleanup logging on process exit
process.on('exit', cleanupTestLogging);
process.on('SIGINT', cleanupTestLogging);
process.on('SIGTERM', cleanupTestLogging);

// Test boundary logging
beforeEach((context) => {
  if (context?.task?.name) {
    testLogger.logTestStart(context.task.name);
  }
});

afterEach((context) => {
  if (context?.task?.name) {
    const status = context.task.result?.state === 'pass' ? 'PASS' :
      context.task.result?.state === 'fail' ? 'FAIL' : 'SKIP';
    testLogger.logTestEnd(context.task.name, status);
  }
});