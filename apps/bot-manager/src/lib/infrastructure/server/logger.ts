/**
 * Server-side logging utilities
 * Provides structured logging for API routes and server operations
 */

interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

class ServerLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    return `[${timestamp}] ${level} ${entry.message}${context}`;
  }

  private log(level: LogEntry['level'], message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    const formattedMessage = this.formatMessage(entry);

    // Log to console based on level
    switch (level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'debug':
        if (this.isDevelopment) {
          console.debug(formattedMessage);
        }
        break;
      default:
        console.log(formattedMessage);
    }

    // In production, you might want to send logs to an external service
    // if (process.env.NODE_ENV === 'production') {
    //   // Send to logging service
    // }
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.log('error', message, context);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }
}

// Export singleton instance
export const logger = new ServerLogger();