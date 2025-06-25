#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    console.log('  DATABASE_URL=xxx pnpm script analyze-spin-data');
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
console.log('');

// Dynamically import and run the script
try {
    if (existsSync(tsScriptPath)) {
        // Use tsx to run TypeScript files
        const { spawn } = await import('child_process');
        const result = spawn('npx', ['tsx', tsScriptPath, ...scriptArgs], {
            stdio: 'inherit',
            cwd: join(__dirname, '..'),
            env: { ...process.env } // Pass all environment variables
        });
        
        result.on('exit', (code) => {
            process.exit(code || 0);
        });
    } else {
        await import(`file://${scriptPath}`);
    }
} catch (error) {
    console.error('❌ Error running script:', error.message);
    process.exit(1);
}