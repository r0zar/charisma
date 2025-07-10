/**
 * Simple server-side logger for API endpoints
 */
class ServerLogger {
  private prefix: string;

  constructor(prefix: string = '[Server]') {
    this.prefix = prefix;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} ${this.prefix} ${level}: ${message}`;
  }

  info(message: string): void {
    console.log(this.formatMessage('INFO', message));
  }

  warn(message: string): void {
    console.warn(this.formatMessage('WARN', message));
  }

  error(message: string, error?: Error): void {
    const errorMessage = error ? `${message} - ${error.message}` : message;
    console.error(this.formatMessage('ERROR', errorMessage));
    if (error && error.stack) {
      console.error(error.stack);
    }
  }

  debug(message: string): void {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      console.log(this.formatMessage('DEBUG', message));
    }
  }
}

export const logger = new ServerLogger('[API]');