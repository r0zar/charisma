/**
 * Logging utility for bot state machine operations
 */

interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: any;
  timestamp: string;
}

class Logger {
  private logs: LogEntry[] = [];

  private log(level: LogEntry['level'], message: string, data?: any) {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    this.logs.push(entry);
    
    // Also log to console for debugging
    const consoleMethod = level === 'error' ? 'error' : 
                         level === 'warn' ? 'warn' : 'log';
    
    if (data) {
      console[consoleMethod](`[${level.toUpperCase()}] ${message}`, data);
    } else {
      console[consoleMethod](`[${level.toUpperCase()}] ${message}`);
    }

    // Keep only last 100 logs to prevent memory issues
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  success(message: string, data?: any) {
    this.log('success', message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }
}

export const syncLogger = new Logger();