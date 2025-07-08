#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readdirSync, mkdirSync, createWriteStream } from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from various .env files
const projectRoot = join(__dirname, '..');
const logsDir = join(projectRoot, 'logs');

// Ensure logs directory exists
if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
}

// Function to create log file name with timestamp
function createLogFileName(scriptName) {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '-');
    return `${scriptName}-${timestamp}.log`;
}

// Function to create a write stream for logging
function createLogStream(scriptName) {
    const logFileName = createLogFileName(scriptName);
    const logFilePath = join(logsDir, logFileName);
    return createWriteStream(logFilePath, { flags: 'w' });
}

// Function to log to both console and file
function logToFile(logStream, message) {
    console.log(message);
    logStream.write(message + '\n');
}
const envFiles = [
    '.env.local',
    '.env.development.local', 
    '.env.development',
    '.env'
];

let envLoaded = false;
let envMessages = [];
envFiles.forEach(envFile => {
    const envPath = join(projectRoot, envFile);
    if (existsSync(envPath)) {
        dotenv.config({ path: envPath });
        const message = `📁 Loaded environment from: ${envFile}`;
        console.log(message);
        envMessages.push(message);
        envLoaded = true;
    }
});

if (!envLoaded) {
    const message = '⚠️  No .env files found';
    console.log(message);
    envMessages.push(message);
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
    console.log('  HIRO_API_KEY=xxx pnpm script test-token-metadata');
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

// Create log stream for this script run
const logStream = createLogStream(scriptName);

// Log environment messages
envMessages.forEach(message => logStream.write(message + '\n'));
if (envMessages.length > 0) {
    logStream.write('\n');
}

logToFile(logStream, `🚀 Running script: ${scriptName}`);
if (scriptArgs.length > 0) {
    logToFile(logStream, `📝 Arguments: ${scriptArgs.join(' ')}`);
}
logToFile(logStream, '');

// Dynamically import and run the script
try {
    if (existsSync(tsScriptPath)) {
        // Use tsx to run TypeScript files
        const { spawn } = await import('child_process');
        const result = spawn('npx', ['tsx', tsScriptPath, ...scriptArgs], {
            stdio: 'pipe',
            cwd: join(__dirname, '..'),
            env: { ...process.env } // Pass all environment variables
        });
        
        // Pipe stdout to both console and log file
        result.stdout.on('data', (data) => {
            const output = data.toString();
            process.stdout.write(output);
            logStream.write(output);
        });
        
        // Pipe stderr to both console and log file
        result.stderr.on('data', (data) => {
            const output = data.toString();
            process.stderr.write(output);
            logStream.write(output);
        });
        
        result.on('exit', (code) => {
            logToFile(logStream, `\n📊 Script completed with exit code: ${code || 0}`);
            logToFile(logStream, `📁 Log saved to: ${logStream.path}`);
            logStream.end();
            process.exit(code || 0);
        });
    } else {
        // For JavaScript files, we need to capture console output
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;
        
        console.log = (...args) => {
            const message = args.join(' ');
            originalConsoleLog(message);
            logStream.write(message + '\n');
        };
        
        console.error = (...args) => {
            const message = args.join(' ');
            originalConsoleError(message);
            logStream.write(message + '\n');
        };
        
        await import(`file://${scriptPath}`);
        
        // Restore original console methods
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        
        logToFile(logStream, `\n📊 Script completed successfully`);
        logToFile(logStream, `📁 Log saved to: ${logStream.path}`);
        logStream.end();
    }
} catch (error) {
    const errorMessage = `❌ Error running script: ${error.message}`;
    console.error(errorMessage);
    logStream.write(errorMessage + '\n');
    logStream.end();
    process.exit(1);
}