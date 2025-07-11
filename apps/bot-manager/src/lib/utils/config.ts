/**
 * App Configuration
 * Individual exported constants determined at runtime
 */

// Environment detection
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const VERCEL_ENV = process.env.VERCEL_ENV;

// Feature flags (boolean constants)
export const ENABLE_API_METADATA = process.env.NEXT_PUBLIC_ENABLE_API_METADATA === 'true';
export const ENABLE_API_USER = process.env.NEXT_PUBLIC_ENABLE_API_USER === 'true';
export const ENABLE_API_BOTS = process.env.NEXT_PUBLIC_ENABLE_API_BOTS === 'true';
export const ENABLE_API_MARKET = process.env.NEXT_PUBLIC_ENABLE_API_MARKET === 'true';
export const ENABLE_API_NOTIFICATIONS = process.env.NEXT_PUBLIC_ENABLE_API_NOTIFICATIONS === 'true';

// API configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';
export const API_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '5000');
export const DEFAULT_USER_ID = process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
export const NEXTAUTH_URL = process.env.NEXTAUTH_URL;

// Cache configuration
export const CACHE_ENABLED = process.env.NEXT_PUBLIC_CACHE_ENABLED === 'true';
export const CACHE_TTL = parseInt(process.env.NEXT_PUBLIC_CACHE_TTL || '300');

// Debug configuration
export const DEBUG_DATA_LOADING = process.env.NEXT_PUBLIC_DEBUG_DATA_LOADING === 'true';
export const DEBUG_LOGGING = process.env.NEXT_PUBLIC_DEBUG_LOGGING === 'true';
export const LOG_DATA_SOURCES = process.env.NEXT_PUBLIC_LOG_DATA_SOURCES === 'true';

// Loading configuration
export const LOADING_CONFIG = process.env.NEXT_PUBLIC_LOADING_CONFIG;


/**
 * Runtime environment detection
 */
export function isServerSide(): boolean {
  return typeof window === 'undefined';
}

export function isClientSide(): boolean {
  return typeof window !== 'undefined';
}