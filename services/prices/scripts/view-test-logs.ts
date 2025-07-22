#!/usr/bin/env tsx
/**
 * Utility to view recent test logs
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const LOGS_DIR = join(process.cwd(), 'logs');

function getLatestLogFile(): string | null {
  try {
    const files = readdirSync(LOGS_DIR)
      .filter(file => file.startsWith('test-') && file.endsWith('.log'))
      .map(file => ({
        name: file,
        path: join(LOGS_DIR, file),
        mtime: statSync(join(LOGS_DIR, file)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    return files.length > 0 ? files[0].path : null;
  } catch (error) {
    console.error('Error reading logs directory:', error);
    return null;
  }
}

function listLogFiles(): void {
  try {
    const files = readdirSync(LOGS_DIR)
      .filter(file => file.startsWith('test-') && file.endsWith('.log'))
      .map(file => {
        const stats = statSync(join(LOGS_DIR, file));
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => b.modified.localeCompare(a.modified));

    if (files.length === 0) {
      console.log('No test log files found.');
      return;
    }

    console.log('Available test log files:');
    console.log('========================');
    files.forEach((file, index) => {
      const sizeKB = Math.round(file.size / 1024);
      console.log(`${index + 1}. ${file.name}`);
      console.log(`   Size: ${sizeKB}KB | Modified: ${file.modified}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error listing log files:', error);
  }
}

function viewLogFile(filePath: string, lines?: number): void {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const logLines = content.split('\n');
    
    if (lines && lines > 0) {
      console.log(`\n=== Last ${lines} lines of ${filePath} ===`);
      console.log(logLines.slice(-lines).join('\n'));
    } else {
      console.log(`\n=== Contents of ${filePath} ===`);
      console.log(content);
    }
  } catch (error) {
    console.error('Error reading log file:', error);
  }
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'list':
    listLogFiles();
    break;
    
  case 'latest':
    const lines = args[1] ? parseInt(args[1]) : undefined;
    const latestFile = getLatestLogFile();
    if (latestFile) {
      viewLogFile(latestFile, lines);
    } else {
      console.log('No log files found.');
    }
    break;
    
  case 'view':
    const filename = args[1];
    if (!filename) {
      console.log('Usage: tsx scripts/view-test-logs.ts view <filename> [lines]');
      break;
    }
    const viewLines = args[2] ? parseInt(args[2]) : undefined;
    const filePath = join(LOGS_DIR, filename);
    viewLogFile(filePath, viewLines);
    break;
    
  default:
    console.log('Test Log Viewer');
    console.log('===============');
    console.log('');
    console.log('Commands:');
    console.log('  list                    - List all test log files');
    console.log('  latest [lines]          - View latest log file (optionally last N lines)');
    console.log('  view <filename> [lines] - View specific log file (optionally last N lines)');
    console.log('');
    console.log('Examples:');
    console.log('  tsx scripts/view-test-logs.ts list');
    console.log('  tsx scripts/view-test-logs.ts latest 50');
    console.log('  tsx scripts/view-test-logs.ts view test-2025-07-22T01-54-11-299Z.log');
    break;
}