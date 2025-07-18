#!/usr/bin/env tsx

/**
 * Script to check all host URLs for availability
 * Usage: pnpm check-urls
 */

import { HOSTS, getHostUrl } from '../src/index';

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

interface CheckResult {
  host: string;
  environment: 'development' | 'production';
  url: string;
  status: 'success' | 'error';
  statusCode?: number;
  responseTime?: number;
  error?: string;
}

async function checkUrl(url: string, timeout = 5000): Promise<{ status: number; responseTime: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      // Disable following redirects for HEAD requests
      redirect: 'manual'
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    // Consider redirects as success
    const status = response.status;
    if (status >= 200 && status < 400) {
      return { status, responseTime };
    }
    
    // Special handling for common cases
    if (status === 405) {
      // Method not allowed - try GET instead
      const getResponse = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      });
      return { status: getResponse.status, responseTime: Date.now() - startTime };
    }
    
    return { status, responseTime };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function checkHost(host: string, env: 'development' | 'production'): Promise<CheckResult> {
  const url = getHostUrl(host as any, env);
  
  try {
    const { status, responseTime } = await checkUrl(url);
    
    return {
      host,
      environment: env,
      url,
      status: status >= 200 && status < 400 ? 'success' : 'error',
      statusCode: status,
      responseTime
    };
  } catch (error) {
    return {
      host,
      environment: env,
      url,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function formatResult(result: CheckResult): string {
  const statusIcon = result.status === 'success' ? '✓' : '✗';
  const statusColor = result.status === 'success' ? colors.green : colors.red;
  const envLabel = result.environment === 'production' ? 'PROD' : 'DEV ';
  
  let line = `${statusColor}${statusIcon}${colors.reset} `;
  line += `${colors.bold}${result.host.padEnd(12)}${colors.reset} `;
  line += `[${envLabel}] `;
  line += `${result.url.padEnd(50)} `;
  
  if (result.status === 'success') {
    line += `${colors.green}${result.statusCode}${colors.reset} `;
    line += `(${result.responseTime}ms)`;
  } else if (result.statusCode) {
    line += `${colors.red}${result.statusCode}${colors.reset}`;
  } else {
    line += `${colors.red}${result.error}${colors.reset}`;
  }
  
  return line;
}

async function main() {
  console.log(`${colors.bold}${colors.blue}Checking Charisma Host URLs${colors.reset}\n`);
  
  const hosts = Object.keys(HOSTS);
  const environments: Array<'development' | 'production'> = ['development', 'production'];
  
  // Group results by environment
  const devResults: CheckResult[] = [];
  const prodResults: CheckResult[] = [];
  
  // Check all URLs in parallel
  const promises: Promise<CheckResult>[] = [];
  
  for (const host of hosts) {
    for (const env of environments) {
      promises.push(checkHost(host, env));
    }
  }
  
  const results = await Promise.all(promises);
  
  // Separate results by environment
  results.forEach(result => {
    if (result.environment === 'development') {
      devResults.push(result);
    } else {
      prodResults.push(result);
    }
  });
  
  // Print development results
  console.log(`${colors.bold}Development URLs:${colors.reset}`);
  devResults.forEach(result => console.log(formatResult(result)));
  
  console.log(); // Empty line
  
  // Print production results
  console.log(`${colors.bold}Production URLs:${colors.reset}`);
  prodResults.forEach(result => console.log(formatResult(result)));
  
  // Summary
  console.log(`\n${colors.bold}Summary:${colors.reset}`);
  const totalSuccess = results.filter(r => r.status === 'success').length;
  const totalError = results.filter(r => r.status === 'error').length;
  
  console.log(`${colors.green}✓ Success: ${totalSuccess}${colors.reset}`);
  if (totalError > 0) {
    console.log(`${colors.red}✗ Failed: ${totalError}${colors.reset}`);
  }
  
  // Exit with error code if any checks failed
  if (totalError > 0) {
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}Error running check-urls:${colors.reset}`, error);
  process.exit(1);
});