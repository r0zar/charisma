import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LogData {
  [key: string]: any;
}

// Simple human-friendly logger (like the legacy execute.sh style)
class SimpleLogger {
  private logFile: string;
  private startTime: Date;
  private initialized: boolean = false;

  constructor(logFile: string) {
    this.logFile = logFile;
    this.startTime = new Date();
  }

  initialize(): void {
    if (this.initialized) return;
    
    // Ensure logs directory exists
    fs.mkdirSync('logs', { recursive: true });
    
    this.writeHeader();
    this.initialized = true;
    
    // Now safely call info after initialization
    this.info('Script session started');
    console.log(`📋 Logging to: ${this.logFile}`);
  }

  writeHeader(): void {
    let nodeVersion = process.version;
    
    const header = `📋 Script Execution Log
📁 Script: ${path.basename(process.argv[1])}
⏰ Started: ${this.startTime.toLocaleString()}
👤 User: ${process.env.USER || 'unknown'}
📂 Working Directory: ${process.cwd()}
🖥️  Platform: ${process.platform}
📦 Node Version: ${nodeVersion}
🔧 Task Runner: Node.js v22 --import tsx
----------------------------------------

`;
    fs.appendFileSync(this.logFile, header);
  }

  writeLog(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(this.logFile, logLine);
  }

  info(message: string, data?: LogData): void {
    if (!this.initialized) this.initialize();
    console.log(`ℹ️  ${message}`);
    this.writeLog(`ℹ️  ${message}`);
  }

  error(message: string, data?: LogData): void {
    if (!this.initialized) this.initialize();
    console.error(`❌ ${message}`);
    this.writeLog(`❌ ${message}`);
  }

  debug(message: string, data?: LogData): void {
    if (!this.initialized) this.initialize();
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`🐛 ${message}`);
      this.writeLog(`🐛 ${message}`);
    }
  }

  warn(message: string, data?: LogData): void {
    if (!this.initialized) this.initialize();
    console.warn(`⚠️  ${message}`);
    this.writeLog(`⚠️  ${message}`);
  }

  success(message: string): void {
    if (!this.initialized) this.initialize();
    console.log(`✅ ${message}`);
    this.writeLog(`✅ ${message}`);
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
    fs.appendFileSync(this.logFile, footer);
  }
}

// Generate timestamp and log filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const scriptName = path.basename(process.argv[1], '.ts');
const logFile = path.join(process.cwd(), 'logs', `${timestamp}-${scriptName}.log`);

export const logger = new SimpleLogger(logFile);

// Helper function to log script execution
export function logExecution(description: string, command: string): void {
  logger.info(`Executing: ${description}`);
}

// Helper function to log script results
export function logResult(description: string, result: { exitCode: number; stdout?: string; stderr?: string }, duration: number): void {
  logger.info(`Completed: ${description}`);
}

// Helper function to log errors
export function logError(description: string, error: Error): void {
  logger.error(`Error: ${description}`);
}

// Write footer on exit
process.on('beforeExit', () => {
  try {
    logger.writeFooter();
  } catch (error) {
    // Ignore footer errors
  }
});

// Handle SIGINT (Ctrl+C) and SIGTERM gracefully
process.on('SIGINT', () => {
  try {
    logger.writeFooter();
  } catch (error) {
    // Ignore footer errors
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  try {
    logger.writeFooter();
  } catch (error) {
    // Ignore footer errors
  }
  process.exit(0);
});