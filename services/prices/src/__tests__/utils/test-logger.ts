/**
 * Test Logger - Redirects console output to timestamped log files
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export class TestLogger {
  private logFile: string;
  private originalConsole: Console;
  
  constructor() {
    // Create logs directory if it doesn't exist
    const logsDir = join(process.cwd(), 'logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    
    // Create timestamped log file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = join(logsDir, `test-${timestamp}.log`);
    
    // Store original console
    this.originalConsole = global.console;
    
    // Initialize log file with header
    writeFileSync(this.logFile, `=== Test Session Started: ${new Date().toISOString()} ===\n`);
  }

  /**
   * Setup console redirection to log file
   */
  redirectConsole(): void {
    const writeToLog = (level: string, ...args: any[]) => {
      const timestamp = new Date().toISOString();
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
      appendFileSync(this.logFile, logEntry);
    };

    global.console = {
      ...this.originalConsole,
      log: (...args: any[]) => writeToLog('log', ...args),
      warn: (...args: any[]) => writeToLog('warn', ...args),
      error: (...args: any[]) => writeToLog('error', ...args),
      info: (...args: any[]) => writeToLog('info', ...args),
      debug: (...args: any[]) => writeToLog('debug', ...args),
    };
  }

  /**
   * Restore original console
   */
  restoreConsole(): void {
    global.console = this.originalConsole;
  }

  /**
   * Write a test separator to the log
   */
  logTestStart(testName: string): void {
    const timestamp = new Date().toISOString();
    const separator = `\n=== TEST: ${testName} - ${timestamp} ===\n`;
    appendFileSync(this.logFile, separator);
  }

  /**
   * Write test completion to the log
   */
  logTestEnd(testName: string, status: 'PASS' | 'FAIL' | 'SKIP'): void {
    const timestamp = new Date().toISOString();
    const separator = `=== TEST END: ${testName} - ${status} - ${timestamp} ===\n\n`;
    appendFileSync(this.logFile, separator);
  }

  /**
   * Write session end to the log
   */
  logSessionEnd(): void {
    const timestamp = new Date().toISOString();
    const separator = `\n=== Test Session Ended: ${timestamp} ===\n`;
    appendFileSync(this.logFile, separator);
  }

  /**
   * Get the current log file path
   */
  getLogFile(): string {
    return this.logFile;
  }

  /**
   * Write a custom message directly to the log
   */
  writeToLog(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [CUSTOM] ${message}\n`;
    appendFileSync(this.logFile, logEntry);
  }
}

// Global test logger instance
let globalTestLogger: TestLogger | null = null;

/**
 * Get or create the global test logger
 */
export function getTestLogger(): TestLogger {
  if (!globalTestLogger) {
    globalTestLogger = new TestLogger();
  }
  return globalTestLogger;
}

/**
 * Initialize test logging (call in setup)
 */
export function initTestLogging(): TestLogger {
  const logger = getTestLogger();
  logger.redirectConsole();
  return logger;
}

/**
 * Cleanup test logging (call in teardown)
 */
export function cleanupTestLogging(): void {
  if (globalTestLogger) {
    globalTestLogger.logSessionEnd();
    globalTestLogger.restoreConsole();
    globalTestLogger = null;
  }
}

/**
 * Helper to log test boundaries
 */
export function logTestBoundary(testName: string, action: 'start' | 'end', status?: 'PASS' | 'FAIL' | 'SKIP'): void {
  const logger = getTestLogger();
  if (action === 'start') {
    logger.logTestStart(testName);
  } else {
    logger.logTestEnd(testName, status || 'PASS');
  }
}