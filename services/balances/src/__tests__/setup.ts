/**
 * Test setup file for Vitest
 */

import { beforeEach, vi } from 'vitest';

// Mock @vercel/kv
vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    mget: vi.fn(),
    mset: vi.fn(),
    scan: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    pipeline: vi.fn(),
    multi: vi.fn(),
    flushall: vi.fn(),
    info: vi.fn()
  }
}));

// Mock @vercel/blob
vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  del: vi.fn(),
  head: vi.fn(),
  list: vi.fn(),
  copy: vi.fn()
}));

// Mock console methods in tests to avoid noise
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
};

// Setup test environment
beforeEach(() => {
  vi.clearAllMocks();
});