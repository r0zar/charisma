/**
 * @modules/discovery
 * Centralized URL discovery module for the charisma monorepo
 */

import { HOSTS } from './hosts';

export type HostName = keyof typeof HOSTS;
export type Environment = 'development' | 'production' | 'test';

/**
 * Check if we're in development environment
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if we're in test environment
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Auto-detect the current environment
 */
export function getEnvironment(): Environment {
  if (isDevelopment()) return 'development';
  if (isTest()) return 'test';
  return 'production';
}

/**
 * Get the URL for a specific host
 * @param hostName - The name of the host to get the URL for
 * @param environment - Optional environment override (defaults to auto-detect)
 * @returns The URL for the specified host and environment
 */
export function getHostUrl(hostName: HostName, environment?: Environment): string {
  const host = HOSTS[hostName];
  if (!host) {
    throw new Error(`Unknown host: ${hostName}`);
  }

  const env = environment || getEnvironment();
  return host[env];
}

// Re-export for direct access if needed
export { HOSTS };
