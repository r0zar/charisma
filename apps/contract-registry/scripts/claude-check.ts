#!/usr/bin/env node

import { resolve } from 'path';
import { watch } from 'fs';

const projectRoot = resolve(__dirname, '..');

async function runClaude(): Promise<void> {
  console.log('🔍 Running Claude check...');
  // return new Promise((resolve, reject) => {
  //   const claude = spawn('claude', [
  //     '-p', 
  //     'Run lint and typecheck on this codebase. If there are any errors, fix them. Exit when complete.',
  //     '--max-turns', '10',
  //     '--dangerously-skip-permissions',
  //     '--verbose',
  //     '--model', 'sonnet'
  //   ], {
  //     cwd: projectRoot,
  //     stdio: ['ignore', 'pipe', 'pipe']
  //   });

  //   let stdout = '';
  //   let stderr = '';

  //   claude.stdout?.on('data', (data) => {
  //     const output = data.toString();
  //     stdout += output;
  //     process.stdout.write(output);
  //   });

  //   claude.stderr?.on('data', (data) => {
  //     const output = data.toString();
  //     stderr += output;
  //     process.stderr.write(output);
  //   });

  //   claude.on('close', (code) => {
  //     if (stderr.includes('Credit balance is too low')) {
  //       console.log('⚠️  Claude credits low - skipping check (this is OK for development)');
  //       resolve();
  //       return;
  //     }

  //     if (code === 0) {
  //       console.log('✅ Claude check completed successfully');
  //       resolve();
  //     } else {
  //       console.error(`❌ Claude check failed with code ${code}`);
  //       reject(new Error(`Claude check failed with code ${code}`));
  //     }
  //   });

  //   claude.on('error', (error) => {
  //     console.error('❌ Failed to start Claude:', error);
  //     reject(error);
  //   });

  //   // Add timeout to prevent hanging
  //   setTimeout(() => {
  //     claude.kill();
  //     console.log('⚠️  Claude check timed out - skipping (this is OK for development)');
  //     resolve();
  //   }, 30000);
  // });
}

async function watchMode(): Promise<void> {
  // Run initial check
  try {
    await runClaude();
  } catch (error) {
    console.error('Initial check failed:', error);
  }

  console.log('👀 Watching for file changes...');

  let debounceTimer: NodeJS.Timeout | null = null;

  const srcWatcher = watch(resolve(projectRoot, 'src'), { recursive: true }, async (eventType, filename) => {
    if (filename && /\.(ts|tsx|js|jsx)$/.test(filename)) {
      console.log(`📝 File changed: ${filename}`);

      // Debounce multiple rapid changes
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        try {
          await runClaude();
        } catch (error) {
          console.error('Check failed:', error);
        }
      }, 1000);
    }
  });

  // Keep the process alive
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping Claude watcher...');
    srcWatcher.close();
    process.exit(0);
  });
}

if (process.argv.includes('--watch')) {
  watchMode().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  runClaude().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}