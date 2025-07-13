/**
 * Environment Variable Loader for Scripts
 * 
 * Centralized environment variable loading for all scripts.
 * Ensures consistent .env.local loading across the project.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Export for explicit loading in scripts that need it
export function loadEnv(): void {
  config({ path: resolve(process.cwd(), '.env.local') });
}

// Validate required environment variables
export function validateRequiredEnvVars(requiredVars: string[]): void {
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('Make sure .env.local is properly configured.');
    process.exit(1);
  }
}

// Get environment variable with fallback
export function getEnvVar(varName: string, fallback?: string): string {
  const value = process.env[varName];
  if (!value && !fallback) {
    throw new Error(`Environment variable ${varName} is not set and no fallback provided`);
  }
  return value || fallback!;
}

// Check if we're in development mode
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

// Check if we're in production mode
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}