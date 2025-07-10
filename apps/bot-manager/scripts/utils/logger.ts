
import path from 'path';

// Generate timestamp and log filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const scriptName = path.basename(process.argv[1], '.ts');

// Synchronous logger for scripts that need immediate logging
class SyncLogger {
  private logFile: string;
  private startTime: Date;

  constructor(logFile: string) {
    this.logFile = logFile;
    this.startTime = new Date();
    this.writeHeader();
  }

  private writeHeader(): void {
    const fs = require('fs');
    const path = require('path');

    // Ensure logs directory exists
    fs.mkdirSync('logs', { recursive: true });

    const header = `📋 Script Execution Log
📁 Script: ${path.basename(process.argv[1])}
⏰ Started: ${this.startTime.toLocaleString()}
👤 User: ${process.env.USER || 'unknown'}
📂 Working Directory: ${process.cwd()}
🖥️  Platform: ${process.platform}
📦 Node Version: ${process.version}
🔧 Task Runner: Node.js --import tsx
----------------------------------------

`;
    fs.appendFileSync(this.logFile, header);
  }

  private writeLog(message: string): void {
    const fs = require('fs');
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(this.logFile, logLine);
  }

  info(message: string, data?: any): void {
    const fullMessage = data ? `${message} ${JSON.stringify(data, null, 2)}` : message;
    console.log(`ℹ️  ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
    this.writeLog(`ℹ️  ${fullMessage}`);
  }

  success(message: string, data?: any): void {
    const fullMessage = data ? `${message} ${JSON.stringify(data, null, 2)}` : message;
    console.log(`✅ ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
    this.writeLog(`✅ ${fullMessage}`);
  }

  warn(message: string, data?: any): void {
    const fullMessage = data ? `${message} ${JSON.stringify(data, null, 2)}` : message;
    console.warn(`⚠️  ${message}`);
    if (data) console.warn(JSON.stringify(data, null, 2));
    this.writeLog(`⚠️  ${fullMessage}`);
  }

  error(message: string, data?: any): void {
    const fullMessage = data ? `${message} ${JSON.stringify(data, null, 2)}` : message;
    console.error(`❌ ${message}`);
    if (data) console.error(JSON.stringify(data, null, 2));
    this.writeLog(`❌ ${fullMessage}`);
  }

  debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      const fullMessage = data ? `${message} ${JSON.stringify(data, null, 2)}` : message;
      console.log(`🔍 ${message}`);
      if (data) console.log(JSON.stringify(data, null, 2));
      this.writeLog(`🔍 ${fullMessage}`);
    }
  }

  writeFooter(): void {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();
    const footer = `
----------------------------------------
⏰ Finished: ${endTime.toLocaleString()}
⏱️  Duration: ${duration}ms
${duration < 5000 ? '✅ Completed successfully' : '🐌 Took longer than expected'}
`;
    const fs = require('fs');
    fs.appendFileSync(this.logFile, footer);
  }
}

// Create sync logger instance
const syncLogFile = path.join(process.cwd(), 'logs', `${timestamp}-${scriptName}.log`);
export const syncLogger = new SyncLogger(syncLogFile);

// Write footer on exit for sync logger
process.on('exit', () => {
  try {
    syncLogger.writeFooter();
  } catch (error) {
    // Ignore footer errors
  }
});

