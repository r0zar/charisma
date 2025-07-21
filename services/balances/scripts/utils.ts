import path from 'path';
import fs from 'fs';

// Load .env.local file
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key) {
                const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                process.env[key.trim()] = value;
            }
        }
    });
} catch (error) {
    console.error('❌ Failed to load .env.local file');
    console.error('Please create a .env.local file in your project root');
    console.error('Example: echo "LOG_LEVEL=info" > .env.local');
    process.exit(1);
}

// Extend the Console interface
declare global {
    interface Console {
        success(...args: any[]): void;
    }
}

// Configuration
const LOG_DIR = process.env.LOG_DIR || 'logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NO_FILE_LOG = process.env.NO_FILE_LOG === 'true';

// Initialize immediately
const startTime = Date.now();
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const scriptName = path.basename(process.argv[1], path.extname(process.argv[1]));
const logFile = path.join(process.cwd(), LOG_DIR, `${timestamp}-${scriptName}.log`);

// Create logs directory
if (!NO_FILE_LOG) {
    try {
        fs.mkdirSync(path.join(process.cwd(), LOG_DIR), { recursive: true });
    } catch (e) {
        // Continue without file logging
    }
}

// Store original console methods
const original = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console)
};

// Create write stream
let writeStream: fs.WriteStream | null = null;
if (!NO_FILE_LOG) {
    try {
        writeStream = fs.createWriteStream(logFile, { flags: 'a' });

        // Write header
        writeStream.write(`📋 ${scriptName} - ${new Date().toLocaleString()}
📂 ${process.cwd()}
🖥️  ${process.platform} | Node ${process.version}
----------------------------------------
`);

        original.log(`📋 Logging to: ${logFile}`);
    } catch (e) {
        writeStream = null;
    }
}

// Simple write function
const write = (message: string) => {
    if (writeStream && !writeStream.destroyed) {
        writeStream.write(`[${new Date().toLocaleTimeString()}] ${message}\n`);
    }
};

// Format arguments for logging
const format = (args: any[]): string =>
    args.map(arg => {
        if (arg instanceof Error) return `${arg.message}\n${arg.stack}`;
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg, null, 2);
            } catch {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');

// Override console methods
console.log = (...args) => {
    original.log(...args);
    write(format(args));
};

console.info = (...args) => {
    original.info(...args);
    write(`ℹ️  ${format(args)}`);
};

console.error = (...args) => {
    original.error(...args);
    write(`❌ ${format(args)}`);
};

console.warn = (...args) => {
    original.warn(...args);
    write(`⚠️  ${format(args)}`);
};

console.debug = (...args) => {
    if (LOG_LEVEL === 'debug') {
        original.log(...args);
        write(`🐛 ${format(args)}`);
    }
};

console.success = (...args) => {
    original.log(`✅`, ...args);
    write(`✅ ${format(args)}`);
};

// Clean exit handler
const cleanup = (code: number = 0) => {
    if (writeStream && !writeStream.destroyed) {
        const duration = Date.now() - startTime;
        writeStream.write(`\n⏱️  Duration: ${(duration / 1000).toFixed(2)}s\n`);
        writeStream.end();
    }
    process.exit(code);
};

// Register exit handlers
process.once('beforeExit', () => cleanup());
process.once('SIGINT', () => cleanup());
process.once('SIGTERM', () => cleanup());
process.once('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    cleanup(1);
});
process.once('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    cleanup(1);
});