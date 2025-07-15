import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
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

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Ensure logs directory exists
    await fs.mkdir('logs', { recursive: true });
    
    await this.writeHeader();
    this.initialized = true;
    
    // Now safely call info after initialization
    await this.info('Script session started');
    console.log(`📋 Logging to: ${this.logFile}`);
  }

  async writeHeader(): Promise<void> {
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
    await fs.appendFile(this.logFile, header);
  }

  async writeLog(message: string): Promise<void> {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `[${timestamp}] ${message}\n`;
    await fs.appendFile(this.logFile, logLine);
  }

  async info(message: string, data?: LogData): Promise<void> {
    if (!this.initialized) await this.initialize();
    console.log(`ℹ️  ${message}`);
    return this.writeLog(`ℹ️  ${message}`);
  }

  async error(message: string, data?: LogData): Promise<void> {
    if (!this.initialized) await this.initialize();
    console.error(`❌ ${message}`);
    return this.writeLog(`❌ ${message}`);
  }

  async debug(message: string, data?: LogData): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`🐛 ${message}`);
      return this.writeLog(`🐛 ${message}`);
    }
    return Promise.resolve();
  }

  async warn(message: string, data?: LogData): Promise<void> {
    if (!this.initialized) await this.initialize();
    console.warn(`⚠️  ${message}`);
    return this.writeLog(`⚠️  ${message}`);
  }

  async success(message: string): Promise<void> {
    if (!this.initialized) await this.initialize();
    console.log(`✅ ${message}`);
    return this.writeLog(`✅ ${message}`);
  }

  async writeFooter(): Promise<void> {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();
    const footer = `
----------------------------------------
⏰ Finished: ${endTime.toLocaleString()}
⏱️  Duration: ${duration}ms
${duration < 5000 ? '✅ Completed successfully' : '🐌 Took longer than expected'}
`;
    await fs.appendFile(this.logFile, footer);
  }
}

// Generate timestamp and log filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const scriptName = path.basename(process.argv[1], '.ts');
const logFile = path.join(process.cwd(), 'logs', `${timestamp}-${scriptName}.log`);

export const logger = new SimpleLogger(logFile);

// Helper function to log script execution
export async function logExecution(description: string, command: string): Promise<void> {
  return logger.info(`Executing: ${description}`);
}

// Helper function to log script results
export async function logResult(description: string, result: { exitCode: number; stdout?: string; stderr?: string }, duration: number): Promise<void> {
  return logger.info(`Completed: ${description}`);
}

// Helper function to log errors
export async function logError(description: string, error: Error): Promise<void> {
  return logger.error(`Error: ${description}`);
}

// Write footer on exit
process.on('exit', async () => {
  try {
    await logger.writeFooter();
  } catch (error) {
    // Ignore footer errors
  }
});