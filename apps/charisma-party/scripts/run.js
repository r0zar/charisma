#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readdirSync, mkdirSync, createWriteStream } from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setup logging
const logDir = join(__dirname, '..', 'logs');
if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = join(logDir, `${timestamp}.log`);

// Load environment variables from various .env files
const projectRoot = join(__dirname, '..');
const envFiles = [
    '.env.local',
    '.env.development.local',
    '.env.development',
    '.env'
];

let envLoaded = false;
envFiles.forEach(envFile => {
    const envPath = join(projectRoot, envFile);
    if (existsSync(envPath)) {
        dotenv.config({ path: envPath });
        console.log(`📁 Loaded environment from: ${envFile}`);
        envLoaded = true;
    }
});

if (!envLoaded) {
    console.log('⚠️  No .env files found');
}

const scriptName = process.argv[2];
const scriptArgs = process.argv.slice(3);

function listAvailableScripts() {
    const scripts = readdirSync(__dirname)
        .filter(file => (file.endsWith('.js') || file.endsWith('.ts')) && file !== 'run.js')
        .map(file => file.replace(/\.(js|ts)$/, ''));

    if (scripts.length === 0) {
        console.log('No scripts available.');
    } else {
        console.log('Available scripts:');
        scripts.forEach(script => console.log(`  - ${script}`));
    }
}

if (!scriptName || scriptName === 'list') {
    console.log('Usage: pnpm script <script-name> [args...]');
    console.log('       pnpm script list');
    console.log('');
    console.log('Environment variables:');
    console.log('  You can set env vars by prefixing the command:');
    console.log('  DATABASE_URL=xxx pnpm script analyze-pools');
    console.log('  Or by creating .env.local file in the project root');
    console.log('');
    listAvailableScripts();
    process.exit(scriptName ? 0 : 1);
}

const scriptPath = join(__dirname, `${scriptName}.js`);
const tsScriptPath = join(__dirname, `${scriptName}.ts`);

if (!existsSync(scriptPath) && !existsSync(tsScriptPath)) {
    console.error(`❌ Script not found: ${scriptName}`);
    console.log('');
    listAvailableScripts();
    process.exit(1);
}

// Set script arguments in process.argv for the script to access
process.argv = ['node', scriptPath, ...scriptArgs];

console.log(`🚀 Running script: ${scriptName}`);
if (scriptArgs.length > 0) {
    console.log(`📝 Arguments: ${scriptArgs.join(' ')}`);
}
console.log(`📄 Logging to: ${logFile}`);
console.log('');

// Create log file stream
const logStream = createWriteStream(logFile, { flags: 'w' });

// Write initial log entry
logStream.write(`========================================\n`);
logStream.write(`Script: ${scriptName}\n`);
logStream.write(`Arguments: ${scriptArgs.join(' ')}\n`);
logStream.write(`Start Time: ${new Date().toISOString()}\n`);
logStream.write(`========================================\n\n`);

// Capture all console output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
    const message = args.join(' ');
    originalConsoleLog(...args);
    logStream.write(`[LOG] ${new Date().toISOString()}: ${message}\n`);
};

console.error = (...args) => {
    const message = args.join(' ');
    originalConsoleError(...args);
    logStream.write(`[ERROR] ${new Date().toISOString()}: ${message}\n`);
};

console.warn = (...args) => {
    const message = args.join(' ');
    originalConsoleWarn(...args);
    logStream.write(`[WARN] ${new Date().toISOString()}: ${message}\n`);
};

// Handle process exit to close log file (for non-spawned scripts)
process.on('exit', () => {
    if (!logStream.destroyed) {
        logStream.write(`\n========================================\n`);
        logStream.write(`End Time: ${new Date().toISOString()}\n`);
        logStream.write(`========================================\n`);
        logStream.end();
    }
});

process.on('SIGINT', () => {
    logStream.write(`\n[INTERRUPT] Script interrupted by user\n`);
    process.exit(130);
});

process.on('uncaughtException', (error) => {
    logStream.write(`\n[UNCAUGHT EXCEPTION] ${error.message}\n${error.stack}\n`);
    process.exit(1);
});

// Dynamically import and run the script
try {
    if (existsSync(tsScriptPath)) {
        // Use tsx to run TypeScript files
        const { spawn } = await import('child_process');
        const result = spawn('npx', ['tsx', tsScriptPath, ...scriptArgs], {
            stdio: ['inherit', 'pipe', 'pipe'], // Pipe stdout and stderr to capture output
            cwd: join(__dirname, '..'),
            env: { ...process.env } // Pass all environment variables
        });

        // Capture and display output from spawned process
        result.stdout.on('data', (data) => {
            const output = data.toString();
            process.stdout.write(output); // Display to console
            logStream.write(output); // Write to log file
        });

        result.stderr.on('data', (data) => {
            const output = data.toString();
            process.stderr.write(output); // Display to console
            logStream.write(output); // Write to log file
        });

        result.on('exit', (code) => {
            logStream.write(`\n========================================\n`);
            logStream.write(`Script exited with code: ${code || 0}\n`);
            logStream.write(`End Time: ${new Date().toISOString()}\n`);
            logStream.write(`========================================\n`);
            logStream.end();
            process.exit(code || 0);
        });
    } else {
        await import(`file://${scriptPath}`);
    }
} catch (error) {
    console.error('❌ Error running script:', error.message);
    process.exit(1);
}