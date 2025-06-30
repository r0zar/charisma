#!/usr/bin/env node

import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
try {
  const envFile = readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key] = value.trim();
    }
  });
  console.log(`📁 Loaded environment from: .env.local`);
} catch (error) {
  console.log(`⚠️ No .env.local file found, continuing with system environment`);
}

// Get script name from command line args
const scriptName = process.argv[2];
if (!scriptName) {
  console.error('❌ Please provide a script name');
  console.error('Usage: pnpm script <script-name>');
  process.exit(1);
}

// Create log filename with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(__dirname, '..', 'logs', `${timestamp}.log`);

// Ensure logs directory exists
import { mkdirSync } from 'fs';
mkdirSync(path.dirname(logFile), { recursive: true });

console.log(`🚀 Running script: ${scriptName}`);
console.log(`📄 Logging to: ${logFile}`);

// Script header for logs
const scriptHeader = [
  '========================================',
  `Script: ${scriptName}`,
  `Arguments: ${process.argv.slice(3).join(' ')}`,
  `Start Time: ${new Date().toISOString()}`,
  '========================================',
  ''
].join('\n');

// Write header to log file
import { writeFileSync, appendFileSync } from 'fs';
writeFileSync(logFile, scriptHeader);

// Run the script with tsx
const scriptPath = path.join(__dirname, `${scriptName}.ts`);
const child = spawn('npx', ['tsx', scriptPath, ...process.argv.slice(3)], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env }
});

// Pipe output to both console and log file
child.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  appendFileSync(logFile, output);
});

child.stderr.on('data', (data) => {
  const output = data.toString();
  process.stderr.write(output);
  appendFileSync(logFile, output);
});

child.on('close', (code) => {
  const footer = `\n========================================\n`;
  appendFileSync(logFile, footer);
  process.exit(code);
});