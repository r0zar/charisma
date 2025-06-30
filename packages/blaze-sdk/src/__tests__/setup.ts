import '@testing-library/jest-dom';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error // Keep error for debugging
};

// Mock window.location for environment detection
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'localhost',
    port: '3000'
  },
  writable: true
});