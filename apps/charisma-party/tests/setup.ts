// Test setup file for charisma-party
// This file runs before each test file

// Set test environment variables
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests (optional)
// global.console = {
//   ...console,
//   log: () => {},
//   debug: () => {},
//   info: () => {},
//   warn: () => {},
// };